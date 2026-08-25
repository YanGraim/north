import { normalizeCharacterMaximumLength } from '@shared/lib/sql-char-length'
import type { DatabaseIntrospection, DatabaseQueryResult, DatabaseTxState } from '@shared/protocols'
import mysql from 'mysql2/promise'
import { serializeRow } from './serialize'
import { withTimeout } from './timeout'
import { commitTransactionSql, rollbackTransactionSql, TransactionController } from './tx'
import type { DatabaseAdapter, ResolvedDatabaseConfig } from './types'
import { groupIntrospection } from './types'

export class MysqlAdapter implements DatabaseAdapter {
  readonly engine: 'mysql' | 'mariadb'
  private connection: mysql.Connection | null = null
  private readonly tx = new TransactionController()

  constructor(engine: 'mysql' | 'mariadb' = 'mysql') {
    this.engine = engine
  }

  async connect(config: ResolvedDatabaseConfig): Promise<void> {
    this.connection = await mysql.createConnection({
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 3306,
      user: config.username ?? undefined,
      password: config.password,
      database: config.database ?? undefined,
      ssl: config.ssl ? {} : undefined,
      connectTimeout: 15_000,
      multipleStatements: false
    })
  }

  async ping(): Promise<void> {
    await this.requireConnection().query('SELECT 1 AS ok')
  }

  async introspect(): Promise<DatabaseIntrospection> {
    const connection = this.requireConnection()
    const [tableRows] = await connection.query(
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
       ORDER BY table_schema, table_name`
    )
    const [columnRows] = await connection.query(
      `SELECT table_schema, table_name, column_name, data_type, is_nullable, column_key, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
       ORDER BY table_schema, table_name, ordinal_position`
    )

    const tables = Array.isArray(tableRows) ? tableRows : []
    const columns = Array.isArray(columnRows) ? columnRows : []

    return groupIntrospection(
      tables.map((row) => {
        const record = row as Record<string, unknown>
        return {
          schema: String(record.table_schema),
          name: String(record.table_name),
          type: String(record.table_type).toLowerCase().includes('view')
            ? ('view' as const)
            : ('table' as const)
        }
      }),
      columns.map((row) => {
        const record = row as Record<string, unknown>
        return {
          schema: String(record.table_schema),
          table: String(record.table_name),
          name: String(record.column_name),
          dataType: String(record.data_type),
          nullable: String(record.is_nullable) === 'YES',
          primaryKey: String(record.column_key).toUpperCase() === 'PRI',
          characterMaximumLength: normalizeCharacterMaximumLength(
            record.character_maximum_length ?? record.CHARACTER_MAXIMUM_LENGTH
          )
        }
      })
    )
  }

  async query(
    sql: string,
    options: { maxRows: number; timeoutMs: number }
  ): Promise<DatabaseQueryResult> {
    const connection = this.requireConnection()
    await this.ensureTransaction(connection)
    const started = Date.now()
    const [result, fields] = await withTimeout(
      connection.query({ sql, timeout: options.timeoutMs }),
      options.timeoutMs,
      () => {
        connection.destroy()
      }
    )

    if (Array.isArray(result)) {
      const columns = (fields ?? []).map((field) => ({
        name: field.name
      }))
      const names = columns.map((col) => col.name)
      const truncated = result.length > options.maxRows
      const sliced = truncated ? result.slice(0, options.maxRows) : result
      const rows = sliced.map((raw) => serializeRow(names, raw as Record<string, unknown>))
      return {
        columns,
        rows,
        rowCount: rows.length,
        affectedRows: null,
        durationMs: Date.now() - started,
        truncated
      }
    }

    const header = result as mysql.ResultSetHeader
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: typeof header.affectedRows === 'number' ? header.affectedRows : 0,
      durationMs: Date.now() - started,
      truncated: false
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
    await this.requireConnection().query(commitTransactionSql(this.engine))
    this.tx.markIdle()
  }

  async rollback(): Promise<void> {
    if (!this.tx.getState().inTransaction) return
    await this.requireConnection().query(rollbackTransactionSql(this.engine))
    this.tx.markIdle()
  }

  async cancel(): Promise<void> {
    this.connection?.destroy()
  }

  async dispose(): Promise<void> {
    const connection = this.connection
    this.connection = null
    if (connection && this.tx.needsRollbackOnDispose()) {
      await connection.query(rollbackTransactionSql(this.engine)).catch(() => undefined)
      this.tx.markIdle()
    }
    await connection?.end().catch(() => undefined)
  }

  private async ensureTransaction(connection: mysql.Connection): Promise<void> {
    const beginSql = this.tx.beginSqlIfNeeded(this.engine)
    if (!beginSql) return
    await connection.query(beginSql)
    this.tx.markInTransaction()
  }

  private requireConnection(): mysql.Connection {
    if (!this.connection) throw new Error('Sessão MySQL não conectada')
    return this.connection
  }
}
