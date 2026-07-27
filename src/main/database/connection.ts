import { join } from 'node:path'
import Database from 'better-sqlite3'

export type SqliteDatabase = Database.Database

/**
 * Opens a SQLite database with North defaults (WAL + foreign keys).
 * Pass `:memory:` for tests.
 */
export function openDatabase(dbPath: string): SqliteDatabase {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

export function getDatabaseFileName(isDev: boolean): string {
  return isDev ? 'north-dev.db' : 'north.db'
}

export function resolveDatabasePath(userDataPath: string, isDev: boolean): string {
  return join(userDataPath, getDatabaseFileName(isDev))
}
