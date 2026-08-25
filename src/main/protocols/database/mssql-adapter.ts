import { normalizeCharacterMaximumLength } from '@shared/lib/sql-char-length'
import type { DatabaseIntrospection, DatabaseQueryResult, DatabaseTxState } from '@shared/protocols'
import { Connection, Request } from 'tedious'
import { serializeRow } from './serialize'
import { withTimeout } from './timeout'
import { commitTransactionSql, rollbackTransactionSql, TransactionController } from './tx'
import type { DatabaseAdapter, ResolvedDatabaseConfig } from './types'
import { groupIntrospection } from './types'

export class MssqlAdapter implements DatabaseAdapter {
  readonly engine = 'mssql' as const
  private connection: Connection | null = null
  private activeRequest: Request | null = null
  private readonly tx = new TransactionController()

  async connect(config: ResolvedDatabaseConfig): Promise<void> {
    const connection = new Connection({
      server: config.host ?? '127.0.0.1',
      authentication: {
        type: 'default',
        options: {
          userName: config.username ?? '',
          password: config.password
        }
      },
      options: {
        port: config.port ?? 1433,
        database: config.database ?? undefined,
        encrypt: config.ssl,
        trustServerCertificate: !config.ssl,
        connectTimeout: 15_000,
        requestTimeout: 30_000,
        rowCollectionOnRequestCompletion: true
      }
    })

    await new Promise<void>((resolve, reject) => {
      connection.on('connect', (error) => {
        if (error) reject(error)
        else resolve()
      })
      connection.connect()
    })

    this.connection = connection
  }

  async ping(): Promise<void> {
    await this.exec('SELECT 1 AS ok')
  }

  async introspect(): Promise<DatabaseIntrospection> {
    const tables = await this.exec<{
      TABLE_SCHEMA: string
      TABLE_NAME: string
      TABLE_TYPE: string
    }>(
      `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
       FROM INFORMATION_SCHEMA.TABLES
       ORDER BY TABLE_SCHEMA, TABLE_NAME`
    )
    const columns = await this.exec<{
      TABLE_SCHEMA: string
      TABLE_NAME: string
      COLUMN_NAME: string
      DATA_TYPE: string
      IS_NULLABLE: string
      CHARACTER_MAXIMUM_LENGTH: number | null
      IS_PRIMARY_KEY: number
    }>(
      `SELECT
         cols.TABLE_SCHEMA,
         cols.TABLE_NAME,
         cols.COLUMN_NAME,
         cols.DATA_TYPE,
         cols.IS_NULLABLE,
         cols.CHARACTER_MAXIMUM_LENGTH,
         CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
       FROM INFORMATION_SCHEMA.COLUMNS cols
       LEFT JOIN (
         SELECT s.name AS TABLE_SCHEMA, t.name AS TABLE_NAME, c.name AS COLUMN_NAME
         FROM sys.indexes i
         JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
         JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
         JOIN sys.tables t ON i.object_id = t.object_id
         JOIN sys.schemas s ON t.schema_id = s.schema_id
         WHERE i.is_primary_key = 1
       ) pk
         ON cols.TABLE_SCHEMA = pk.TABLE_SCHEMA
        AND cols.TABLE_NAME = pk.TABLE_NAME
        AND cols.COLUMN_NAME = pk.COLUMN_NAME
       ORDER BY cols.TABLE_SCHEMA, cols.TABLE_NAME, cols.ORDINAL_POSITION`
    )

    return groupIntrospection(
      tables.rows.map((row) => ({
        schema: row.TABLE_SCHEMA,
        name: row.TABLE_NAME,
        type: row.TABLE_TYPE.toLowerCase().includes('view') ? 'view' : 'table'
      })),
      columns.rows.map((row) => ({
        schema: row.TABLE_SCHEMA,
        table: row.TABLE_NAME,
        name: row.COLUMN_NAME,
        dataType: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        primaryKey: Number(row.IS_PRIMARY_KEY) === 1,
        characterMaximumLength: normalizeCharacterMaximumLength(row.CHARACTER_MAXIMUM_LENGTH)
      }))
    )
  }

  async query(
    sql: string,
    options: { maxRows: number; timeoutMs: number }
  ): Promise<DatabaseQueryResult> {
    await this.ensureTransaction()
    const started = Date.now()
    const result = await withTimeout(
      this.exec<Record<string, unknown>>(sql),
      options.timeoutMs,
      () => {
        this.activeRequest?.cancel()
      }
    )
    const truncated = result.rows.length > options.maxRows
    const sliced = truncated ? result.rows.slice(0, options.maxRows) : result.rows
    const names = result.columns
    return {
      columns: names.map((name) => ({ name })),
      rows: sliced.map((raw) => serializeRow(names, raw)),
      rowCount: sliced.length,
      affectedRows: names.length === 0 ? result.rowCount : null,
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
    await this.exec(commitTransactionSql(this.engine))
    this.tx.markIdle()
  }

  async rollback(): Promise<void> {
    if (!this.tx.getState().inTransaction) return
    await this.exec(rollbackTransactionSql(this.engine))
    this.tx.markIdle()
  }

  async cancel(): Promise<void> {
    this.activeRequest?.cancel()
  }

  async dispose(): Promise<void> {
    const connection = this.connection
    this.connection = null
    this.activeRequest = null
    if (!connection) return
    if (this.tx.needsRollbackOnDispose()) {
      try {
        this.connection = connection
        await this.exec(rollbackTransactionSql(this.engine))
        this.tx.markIdle()
      } catch {
        // ignore
      } finally {
        this.connection = null
      }
    }
    await new Promise<void>((resolve) => {
      connection.on('end', () => resolve())
      connection.close()
      setTimeout(resolve, 1000)
    })
  }

  private async ensureTransaction(): Promise<void> {
    const beginSql = this.tx.beginSqlIfNeeded(this.engine)
    if (!beginSql) return
    await this.exec(beginSql)
    this.tx.markInTransaction()
  }

  private async exec<T extends object>(
    sql: string
  ): Promise<{ columns: string[]; rows: T[]; rowCount: number }> {
    const connection = this.requireConnection()
    return new Promise((resolve, reject) => {
      const rows: T[] = []
      let columns: string[] = []
      const request = new Request(sql, (error, rowCount) => {
        this.activeRequest = null
        if (error) {
          reject(error)
          return
        }
        resolve({ columns, rows, rowCount: rowCount ?? rows.length })
      })
      request.on('columnMetadata', (columnsMetadata) => {
        const list = Array.isArray(columnsMetadata) ? columnsMetadata : [columnsMetadata]
        columns = list.map((col) => col.colName)
      })
      request.on('row', (rowColumns) => {
        const row: Record<string, unknown> = {}
        for (const col of rowColumns) {
          row[col.metadata.colName] = col.value
        }
        rows.push(row as T)
      })
      this.activeRequest = request
      connection.execSql(request)
    })
  }

  private requireConnection(): Connection {
    if (!this.connection) throw new Error('Sessão SQL Server não conectada')
    return this.connection
  }
}
