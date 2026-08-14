import type { DatabaseIntrospection, DatabaseQueryResult, DatabaseTxState } from '@shared/protocols'
import { Client } from 'pg'
import { serializeRow } from './serialize'
import { withTimeout } from './timeout'
import { commitTransactionSql, rollbackTransactionSql, TransactionController } from './tx'
import type { DatabaseAdapter, ResolvedDatabaseConfig } from './types'
import { groupIntrospection } from './types'

const SKIP_SCHEMAS = `('pg_catalog', 'information_schema', 'pg_toast')`

export class PostgresAdapter implements DatabaseAdapter {
  readonly engine = 'postgres' as const
  private client: Client | null = null
  private readonly tx = new TransactionController()

  async connect(config: ResolvedDatabaseConfig): Promise<void> {
    const client = new Client({
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 5432,
      user: config.username ?? undefined,
      password: config.password,
      database: config.database ?? undefined,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 15_000
    })
    await client.connect()
    this.client = client
  }

  async ping(): Promise<void> {
    await this.requireClient().query('SELECT 1 AS ok')
  }

  async introspect(): Promise<DatabaseIntrospection> {
    const client = this.requireClient()
    const tables = await client.query<{
      table_schema: string
      table_name: string
      table_type: string
    }>(
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema NOT IN ${SKIP_SCHEMAS}
       ORDER BY table_schema, table_name`
    )
    const columns = await client.query<{
      table_schema: string
      table_name: string
      column_name: string
      data_type: string
      is_nullable: string
    }>(
      `SELECT
         cols.table_schema,
         cols.table_name,
         cols.column_name,
         cols.data_type,
         cols.is_nullable
       FROM information_schema.columns cols
       WHERE cols.table_schema NOT IN ${SKIP_SCHEMAS}
       ORDER BY cols.table_schema, cols.table_name, cols.ordinal_position`
    )
    // pg_catalog is more reliable than information_schema joins for PRIMARY KEY
    // (constraint_schema mismatches and driver bool quirks).
    const primaryKeys = await client.query<{
      table_schema: string
      table_name: string
      column_name: string
    }>(
      `SELECT
         n.nspname AS table_schema,
         c.relname AS table_name,
         a.attname AS column_name
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a
         ON a.attrelid = c.oid
        AND a.attnum = ANY (i.indkey)
        AND a.attnum > 0
        AND NOT a.attisdropped
       WHERE i.indisprimary
         AND c.relkind IN ('r', 'p')
         AND n.nspname NOT IN ${SKIP_SCHEMAS}`
    )

    const pkSet = new Set(
      primaryKeys.rows.map(
        (row) =>
          `${row.table_schema.toLowerCase()}\0${row.table_name.toLowerCase()}\0${row.column_name.toLowerCase()}`
      )
    )

    return groupIntrospection(
      tables.rows.map((row) => ({
        schema: row.table_schema,
        name: row.table_name,
        type: row.table_type.toLowerCase().includes('view') ? 'view' : 'table'
      })),
      columns.rows.map((row) => {
        const key = `${row.table_schema.toLowerCase()}\0${row.table_name.toLowerCase()}\0${row.column_name.toLowerCase()}`
        return {
          schema: row.table_schema,
          table: row.table_name,
          name: row.column_name,
          dataType: row.data_type,
          nullable: row.is_nullable === 'YES',
          primaryKey: pkSet.has(key)
        }
      })
    )
  }

  async query(
    sql: string,
    options: { maxRows: number; timeoutMs: number }
  ): Promise<DatabaseQueryResult> {
    const client = this.requireClient()
    await this.ensureTransaction(client)
    const started = Date.now()
    const result = await withTimeout(
      client.query({ text: sql, rowMode: 'array' }),
      options.timeoutMs,
      () => {
        const pid = postgresPid(client)
        if (pid) {
          void client.query('SELECT pg_cancel_backend($1)', [pid]).catch(() => undefined)
        }
      }
    )

    const columns = (result.fields ?? []).map((field) => ({
      name: field.name,
      dataType: undefined
    }))
    const names = columns.map((col) => col.name)
    const truncated = result.rows.length > options.maxRows
    const sliced = truncated ? result.rows.slice(0, options.maxRows) : result.rows
    const rows = sliced.map((raw) => serializeRow(names, raw as unknown[]))

    return {
      columns,
      rows,
      rowCount: rows.length,
      affectedRows:
        columns.length === 0 && typeof result.rowCount === 'number' ? result.rowCount : null,
      durationMs: Date.now() - started,
      truncated
    }
  }

  getTxState(): DatabaseTxState {
    return this.tx.getState()
  }

  async setAutoCommit(on: boolean): Promise<void> {
    this.tx.setAutoCommit(on)
  }

  async commit(): Promise<void> {
    if (!this.tx.getState().inTransaction) return
    await this.requireClient().query(commitTransactionSql(this.engine))
    this.tx.markIdle()
  }

  async rollback(): Promise<void> {
    if (!this.tx.getState().inTransaction) return
    await this.requireClient().query(rollbackTransactionSql(this.engine))
    this.tx.markIdle()
  }

  async cancel(): Promise<void> {
    const client = this.client
    const pid = client ? postgresPid(client) : undefined
    if (!client || !pid) return
    await client.query('SELECT pg_cancel_backend($1)', [pid]).catch(() => undefined)
  }

  async dispose(): Promise<void> {
    const client = this.client
    this.client = null
    if (client && this.tx.needsRollbackOnDispose()) {
      await client.query(rollbackTransactionSql(this.engine)).catch(() => undefined)
      this.tx.markIdle()
    }
    await client?.end().catch(() => undefined)
  }

  private async ensureTransaction(client: Client): Promise<void> {
    const beginSql = this.tx.beginSqlIfNeeded(this.engine)
    if (!beginSql) return
    await client.query(beginSql)
    this.tx.markInTransaction()
  }

  private requireClient(): Client {
    if (!this.client) throw new Error('Sessão PostgreSQL não conectada')
    return this.client
  }
}

function postgresPid(client: Client): number | undefined {
  const raw = client as Client & { processID?: number; processId?: number }
  return raw.processID ?? raw.processId
}

/** Postgres may return bool as boolean or as 't'/'f' depending on driver/settings. */
export function pgBool(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1 || value === '1'
}
