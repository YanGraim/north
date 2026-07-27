import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Initial schema: clients → environments → groups → connections,
 * plus tags, connection_tags and connection_history.
 */
export const migration001InitialSchema: Migration = {
  version: 1,
  name: '001-initial-schema',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE clients (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        notes TEXT,
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE environments (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE groups (
        id TEXT PRIMARY KEY NOT NULL,
        environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE connections (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        protocol TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT,
        auth_method TEXT NOT NULL,
        credential_ref TEXT,
        private_key_path TEXT,
        jump_host_id TEXT REFERENCES connections(id) ON DELETE SET NULL,
        default_command TEXT,
        notes TEXT,
        os TEXT,
        icon TEXT,
        color TEXT,
        owner TEXT,
        links TEXT,
        vpn_required INTEGER NOT NULL DEFAULT 0,
        checklist TEXT,
        related_files TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        access_count INTEGER NOT NULL DEFAULT 0,
        total_connected_ms INTEGER NOT NULL DEFAULT 0,
        last_connected_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE tags (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE,
        color TEXT,
        UNIQUE (name COLLATE NOCASE)
      );

      CREATE TABLE connection_tags (
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (connection_id, tag_id)
      );

      CREATE TABLE connection_history (
        id TEXT PRIMARY KEY NOT NULL,
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        connected_at TEXT NOT NULL,
        duration_ms INTEGER,
        success INTEGER NOT NULL,
        error_message TEXT
      );

      CREATE INDEX idx_environments_client_id ON environments(client_id);
      CREATE INDEX idx_groups_environment_id ON groups(environment_id);
      CREATE INDEX idx_connections_host ON connections(host);
      CREATE INDEX idx_connections_group_id ON connections(group_id);
      CREATE INDEX idx_connections_is_favorite ON connections(is_favorite);
      CREATE INDEX idx_connection_tags_tag_id ON connection_tags(tag_id);
      CREATE INDEX idx_history_connection_connected
        ON connection_history(connection_id, connected_at DESC);
    `)
  }
}
