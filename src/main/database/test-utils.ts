import { createRepositories, type Repositories } from '../repositories'
import { openDatabase, type SqliteDatabase } from './connection'
import { getUserVersion, migrate } from './migrate'
import { migrations } from './migrations'

export function createTestDatabase(): SqliteDatabase {
  const db = openDatabase(':memory:')
  migrate(db, migrations)
  return db
}

export function createTestRepositories(): {
  db: SqliteDatabase
  repos: Repositories
} {
  const db = createTestDatabase()
  return { db, repos: createRepositories(db) }
}

export { getUserVersion }
