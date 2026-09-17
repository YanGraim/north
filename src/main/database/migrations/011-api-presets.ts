import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Reusable Headers/Auth presets for the API client (Postman-style "Globals").
 * Global on purpose: a preset is meant to be applied to any request from any
 * collection/client, unlike Collections which are scoped to a Client (see
 * migration 009). `headers`/`auth` follow the same plaintext-with-{{var}}
 * convention already used by ApiRequest.definition — no vault plumbing here.
 */
export const migration011ApiPresets: Migration = {
  version: 11,
  name: '011-api-presets',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE api_presets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        headers TEXT NOT NULL,
        auth TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_api_presets_name ON api_presets(name COLLATE NOCASE);
    `)
  }
}
