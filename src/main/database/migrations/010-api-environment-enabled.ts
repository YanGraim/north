import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * API accesses only join the Postman-like environment selector, gain the
 * implicit {{baseUrl}} variable, and become connectable when this flag is on.
 * Off by default: a plain API access is just a stored URL, nothing else.
 */
export const migration010ApiEnvironmentEnabled: Migration = {
  version: 10,
  name: '010-api-environment-enabled',
  up(db: SqliteDatabase): void {
    db.exec(`
      ALTER TABLE accesses ADD COLUMN api_environment_enabled INTEGER NOT NULL DEFAULT 0;
    `)
  }
}
