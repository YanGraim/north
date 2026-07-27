import { app } from 'electron'
import { openDatabase, resolveDatabasePath, type SqliteDatabase } from './connection'
import { migrate } from './migrate'
import { migrations } from './migrations'

let db: SqliteDatabase | null = null

export function initDatabase(): SqliteDatabase {
  if (db) {
    return db
  }

  const isDev = !app.isPackaged
  const dbPath = resolveDatabasePath(app.getPath('userData'), isDev)
  db = openDatabase(dbPath)
  migrate(db, migrations)
  return db
}

export function getDatabase(): SqliteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export { maybeSeedDevData, seedDevData } from './seed'
export type { SqliteDatabase }
export { migrate, migrations, openDatabase, resolveDatabasePath }
