import { parseSqliteCharacterMaximumLength } from '@shared/lib/sql-char-length'
import {
  DATABASE_MAX_ROWS,
  type DatabaseIntrospection,
  type DatabaseQueryResult,
  type DatabaseTxState
} from '@shared/protocols'
import Database from 'better-sqlite3'
import { serializeRow } from './serialize'
import { looksLikeResultQuery } from './sql'
import { commitTransactionSql, rollbackTransactionSql, TransactionController } from './tx'
import type { DatabaseAdapter, ResolvedDatabaseConfig } from './types'
import { groupIntrospection } from './types'

export class SqliteAdapter implements DatabaseAdapter {
  readonly engine = 'sqlite' as const
  private db: Database.Database | null = null
  private readonly tx = new TransactionController()

  async connect(config: ResolvedDatabaseConfig): Promise<void> {
    const filePath = config.filePath?.trim()
    if (!filePath) throw new Error('Informe o arquivo SQLite')
    this.db = new Database(filePath)
  }

  async ping(): Promise<void> {
    this.requireDb().prepare('SELECT 1 AS ok').get()
  }

  async introspect(): Promise<DatabaseIntrospection> {
    const db = this.requireDb()
    const tables = db
      .prepare(
        `SELECT name, type FROM sqlite_master
         WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      )
      .all() as Array<{ name: string; type: string }>

    const tableRows = tables.map((row) => ({
      schema: 'main',
      name: row.name,
      type: row.type === 'view' ? ('view' as const) : ('table' as const)
    }))

    const columns = tables.flatMap((table) => {
      const info = db.prepare(`PRAGMA table_info(${quoteSqliteIdent(table.name)})`).all() as Array<{
        name: string
        type: string
        notnull: number
        pk: number
      }>
      return info.map((col) => ({
        schema: 'main',
        table: table.name,
        name: col.name,
        dataType: col.type || 'ANY',
        nullable: col.notnull === 0,
        primaryKey: col.pk > 0,
        characterMaximumLength: parseSqliteCharacterMaximumLength(col.type || '')
      }))
    })

    return groupIntrospection(tableRows, columns)
  }

  async query(
    sql: string,
    options: { maxRows: number; timeoutMs: number }
  ): Promise<DatabaseQueryResult> {
    const db = this.requireDb()
    this.ensureTransaction(db)
    const started = Date.now()
    const maxRows = options.maxRows > 0 ? options.maxRows : DATABASE_MAX_ROWS
    const stmt = db.prepare(sql)

    if (stmt.reader || looksLikeResultQuery(sql)) {
      const columns = stmt.columns().map((col) => col.name)
      const rawRows = stmt.iterate()
      const rows: Array<Record<string, ReturnType<typeof serializeRow>[string]>> = []
      let truncated = false
      for (const raw of rawRows) {
        if (rows.length >= maxRows) {
          truncated = true
          break
        }
        rows.push(serializeRow(columns, raw as Record<string, unknown>))
      }
      return {
        columns: columns.map((name) => ({ name })),
        rows,
        rowCount: rows.length,
        affectedRows: null,
        durationMs: Date.now() - started,
        truncated
      }
    }

    const info = stmt.run()
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: Number(info.changes),
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
    this.requireDb().exec(commitTransactionSql(this.engine))
    this.tx.markIdle()
  }

  async rollback(): Promise<void> {
    if (!this.tx.getState().inTransaction) return
    this.requireDb().exec(rollbackTransactionSql(this.engine))
    this.tx.markIdle()
  }

  async cancel(): Promise<void> {
    // better-sqlite3 is synchronous; cancel is a no-op.
  }

  async dispose(): Promise<void> {
    const db = this.db
    this.db = null
    if (db && this.tx.needsRollbackOnDispose()) {
      try {
        db.exec(rollbackTransactionSql(this.engine))
      } catch {
        // ignore — connection may already be broken
      }
      this.tx.markIdle()
    }
    db?.close()
  }

  private ensureTransaction(db: Database.Database): void {
    const beginSql = this.tx.beginSqlIfNeeded(this.engine)
    if (!beginSql) return
    db.exec(beginSql)
    this.tx.markInTransaction()
  }

  private requireDb(): Database.Database {
    if (!this.db) throw new Error('Sessão SQLite não conectada')
    return this.db
  }
}

function quoteSqliteIdent(ident: string): string {
  return `"${ident.replaceAll('"', '""')}"`
}
