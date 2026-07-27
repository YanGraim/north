import type { SqliteDatabase } from './connection'

export type Migration = {
  version: number
  name: string
  up: (db: SqliteDatabase) => void
}

/**
 * Applies pending migrations in order, controlled by PRAGMA user_version.
 * Each batch runs inside a single transaction.
 */
export function migrate(db: SqliteDatabase, migrations: Migration[]): void {
  const currentVersion = Number(db.pragma('user_version', { simple: true }))
  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version)

  if (pending.length === 0) {
    return
  }

  const apply = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    }
  })

  apply()
}

export function getUserVersion(db: SqliteDatabase): number {
  return Number(db.pragma('user_version', { simple: true }))
}
