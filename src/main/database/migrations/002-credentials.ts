import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Encrypted credential blobs (safeStorage ciphertext), referenced by connections.credential_ref.
 */
export const migration002Credentials: Migration = {
  version: 2,
  name: '002-credentials',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE credentials (
        id TEXT PRIMARY KEY NOT NULL,
        ciphertext BLOB NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
  }
}
