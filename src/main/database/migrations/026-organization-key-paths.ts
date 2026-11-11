import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Where this person's SSH key lives for each organization connection. The
 * organization never stores a key path (the file is on one person's machine),
 * so each member keeps their own here, like their VPN choice (REC-025).
 */
export const migration026OrganizationKeyPaths: Migration = {
  version: 26,
  name: '026-organization-key-paths',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE organization_key_paths (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        connection_id TEXT NOT NULL,
        private_key_path TEXT NOT NULL,
        PRIMARY KEY (workspace_id, connection_id)
      );
    `)
  }
}
