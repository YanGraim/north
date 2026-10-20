import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Workspaces (ADR 0018). The built-in `local` row is the personal workspace
 * backed by this same database; organization rows (phase 2) only hold the
 * server URL — their inventory never lands in SQLite.
 */
export const migration017Workspaces: Migration = {
  version: 17,
  name: '017-workspaces',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('local', 'organization')),
        server_url TEXT,
        created_at TEXT NOT NULL,
        CHECK (kind = 'local' OR server_url IS NOT NULL)
      );
    `)
    db.prepare(
      `INSERT INTO workspaces (id, name, kind, server_url, created_at)
       VALUES ('local', 'Pessoal', 'local', NULL, ?)`
    ).run(new Date().toISOString())
  }
}
