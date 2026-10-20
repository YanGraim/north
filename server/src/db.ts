import type { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

/** The slice of a Postgres client the server uses — `pg` in production, PGlite in tests. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  /** Runs a multi-statement script without parameters (migrations). */
  exec(sql: string): Promise<void>
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString })
  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      const res = await pool.query(sql, params)
      return { rows: res.rows as T[] }
    },
    exec: async (sql) => {
      await pool.query(sql)
    },
    transaction: async (fn) => {
      const client = await pool.connect()
      const tx: Db = {
        query: async <T>(sql: string, params?: unknown[]) => {
          const res = await client.query(sql, params)
          return { rows: res.rows as T[] }
        },
        exec: async (sql) => {
          await client.query(sql)
        },
        transaction: (inner) => inner(tx),
        close: async () => undefined
      }
      try {
        await client.query('BEGIN')
        const result = await fn(tx)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
    close: () => pool.end()
  }
}

export function createPgliteDb(pglite: PGlite): Db {
  const db: Db = {
    query: async <T>(sql: string, params?: unknown[]) => {
      const res = await pglite.query<T>(sql, params as unknown[])
      return { rows: res.rows }
    },
    exec: async (sql) => {
      await pglite.exec(sql)
    },
    transaction: (fn) =>
      pglite.transaction(async (t) => {
        const tx: Db = {
          query: async <T>(sql: string, params?: unknown[]) => ({
            rows: (await t.query<T>(sql, params as unknown[])).rows
          }),
          exec: async (sql) => {
            await t.exec(sql)
          },
          transaction: (inner) => inner(tx),
          close: async () => undefined
        }
        return fn(tx)
      }) as never,
    close: () => pglite.close()
  }
  return db
}
