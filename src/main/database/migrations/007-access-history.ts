import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * SQL studio: access_history for database sessions opened from Access.
 * Engine `sqlite` is a valid accesses.engine value (column is unconstrained TEXT).
 */
export const migration007AccessHistory: Migration = {
  version: 7,
  name: '007-access-history',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE access_history (
        id TEXT PRIMARY KEY NOT NULL,
        access_id TEXT NOT NULL REFERENCES accesses(id) ON DELETE CASCADE,
        connected_at TEXT NOT NULL,
        duration_ms INTEGER,
        success INTEGER NOT NULL,
        error_message TEXT
      );

      CREATE INDEX idx_access_history_access_connected
        ON access_history(access_id, connected_at DESC);
    `)
  }
}
