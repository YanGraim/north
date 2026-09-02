import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

export const migration008ApiClient: Migration = {
  version: 8,
  name: '008-api-client',
  up(db: SqliteDatabase): void {
    db.exec(`
      ALTER TABLE accesses ADD COLUMN api_config TEXT;

      CREATE TABLE api_collections (
        id TEXT PRIMARY KEY NOT NULL,
        access_id TEXT NOT NULL REFERENCES accesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE api_folders (
        id TEXT PRIMARY KEY NOT NULL,
        collection_id TEXT NOT NULL REFERENCES api_collections(id) ON DELETE CASCADE,
        parent_folder_id TEXT REFERENCES api_folders(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE api_requests (
        id TEXT PRIMARY KEY NOT NULL,
        collection_id TEXT NOT NULL REFERENCES api_collections(id) ON DELETE CASCADE,
        folder_id TEXT REFERENCES api_folders(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        definition TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE api_variables (
        id TEXT PRIMARY KEY NOT NULL,
        access_id TEXT NOT NULL REFERENCES accesses(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT,
        is_secret INTEGER NOT NULL DEFAULT 0,
        credential_ref TEXT,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (access_id, key),
        CHECK (is_secret = 0 OR value IS NULL)
      );

      CREATE TABLE api_request_history (
        id TEXT PRIMARY KEY NOT NULL,
        access_id TEXT NOT NULL REFERENCES accesses(id) ON DELETE CASCADE,
        request_id TEXT REFERENCES api_requests(id) ON DELETE SET NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        status_code INTEGER,
        duration_ms INTEGER,
        size_bytes INTEGER,
        error_kind TEXT,
        error_message TEXT,
        executed_at TEXT NOT NULL
      );

      CREATE INDEX idx_api_collections_access_id ON api_collections(access_id);
      CREATE INDEX idx_api_folders_collection_id ON api_folders(collection_id);
      CREATE INDEX idx_api_requests_collection_id ON api_requests(collection_id);
      CREATE INDEX idx_api_variables_access_id ON api_variables(access_id);
      CREATE INDEX idx_api_request_history_access_executed
        ON api_request_history(access_id, executed_at DESC);
    `)
  }
}
