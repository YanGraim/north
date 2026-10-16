import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * VPN profiles (ADR 0017). `config` is Zod-validated JSON without secrets;
 * secrets live in `vpn_secrets → credentials` (same bag shape as
 * `connection_secrets`). Clients/environments link a profile; connections and
 * accesses inherit by default (`vpn_mode`). Deleting a profile nulls links and
 * cascades its secret rows — vault blobs are wiped by the caller first.
 * The legacy `connections.vpn_required` flag stays for import/export compat.
 */
export const migration016Vpn: Migration = {
  version: 16,
  name: '016-vpn',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE vpn_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        config TEXT NOT NULL,
        auto_disconnect TEXT NOT NULL DEFAULT 'when-idle',
        idle_timeout_sec INTEGER NOT NULL DEFAULT 300,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_vpn_profiles_client_id ON vpn_profiles(client_id);

      CREATE TABLE vpn_secrets (
        vpn_profile_id TEXT NOT NULL REFERENCES vpn_profiles(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        credential_ref TEXT NOT NULL,
        PRIMARY KEY (vpn_profile_id, kind)
      );

      CREATE TABLE vpn_history (
        id TEXT PRIMARY KEY NOT NULL,
        vpn_profile_id TEXT NOT NULL REFERENCES vpn_profiles(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        trigger TEXT NOT NULL,
        result TEXT NOT NULL,
        error_code TEXT
      );
      CREATE INDEX idx_vpn_history_profile ON vpn_history(vpn_profile_id, started_at DESC);

      ALTER TABLE clients ADD COLUMN vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE SET NULL;
      ALTER TABLE environments ADD COLUMN vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE SET NULL;
      ALTER TABLE connections ADD COLUMN vpn_mode TEXT NOT NULL DEFAULT 'inherit';
      ALTER TABLE connections ADD COLUMN vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE SET NULL;
      ALTER TABLE accesses ADD COLUMN vpn_mode TEXT NOT NULL DEFAULT 'inherit';
      ALTER TABLE accesses ADD COLUMN vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE SET NULL;
    `)
  }
}
