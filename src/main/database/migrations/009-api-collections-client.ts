import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Collections belong to a Client (or are global). URL stays on Access.
 * Rebuilds api_collections: drop access_id, add nullable client_id.
 * Orphans (broken access → group → environment → client chain) are discarded.
 */
export const migration009ApiCollectionsClient: Migration = {
  version: 9,
  name: '009-api-collections-client',
  up(db: SqliteDatabase): void {
    db.exec(`
      PRAGMA defer_foreign_keys = ON;

      CREATE TABLE api_collections_new (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO api_collections_new (
        id, client_id, name, description, sort_order, created_at, updated_at
      )
      SELECT
        c.id,
        e.client_id,
        c.name,
        c.description,
        c.sort_order,
        c.created_at,
        c.updated_at
      FROM api_collections c
      INNER JOIN accesses a ON a.id = c.access_id
      INNER JOIN groups g ON g.id = a.group_id
      INNER JOIN environments e ON e.id = g.environment_id;

      DELETE FROM api_collections
      WHERE id NOT IN (SELECT id FROM api_collections_new);

      DROP TABLE api_collections;
      ALTER TABLE api_collections_new RENAME TO api_collections;

      CREATE INDEX idx_api_collections_client_id ON api_collections(client_id);
    `)
  }
}
