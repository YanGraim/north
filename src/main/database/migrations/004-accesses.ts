import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Access entity: inventory of secrets/metadata (database | login | other).
 * Does not open sessions — separate from connections.
 */
export const migration004Accesses: Migration = {
  version: 4,
  name: '004-accesses',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE accesses (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        notes TEXT,
        username TEXT,
        credential_ref TEXT,
        url TEXT,
        links TEXT,
        icon TEXT,
        color TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        engine TEXT,
        host TEXT,
        port INTEGER,
        database_name TEXT,
        ssl INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE access_tags (
        access_id TEXT NOT NULL REFERENCES accesses(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (access_id, tag_id)
      );

      CREATE INDEX idx_accesses_group_id ON accesses(group_id);
      CREATE INDEX idx_accesses_type ON accesses(type);
      CREATE INDEX idx_accesses_is_favorite ON accesses(is_favorite);
      CREATE INDEX idx_accesses_host ON accesses(host);
      CREATE INDEX idx_access_tags_tag_id ON access_tags(tag_id);
    `)
  }
}
