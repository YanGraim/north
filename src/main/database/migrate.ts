import type { SqliteDatabase } from './connection'

export type Migration = {
  version: number
  name: string
  up: (db: SqliteDatabase) => void
}

/**
 * Applies pending migrations in order, controlled by PRAGMA user_version.
 * Each migration runs in its own transaction with foreign keys off so table
 * rebuilds (SQLite ALTER TABLE pattern) can drop/rename parents safely.
 */
export function migrate(db: SqliteDatabase, migrations: Migration[]): void {
  const currentVersion = Number(db.pragma('user_version', { simple: true }))
  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    db.pragma('foreign_keys = OFF')
    const apply = db.transaction(() => {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    })
    apply()
    db.pragma('foreign_keys = ON')
  }
}

export function getUserVersion(db: SqliteDatabase): number {
  return Number(db.pragma('user_version', { simple: true }))
}
