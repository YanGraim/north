import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * SSH known_hosts for host key verification (trust-on-first-use + mismatch block).
 */
export const migration003KnownHosts: Migration = {
  version: 3,
  name: '003-known-hosts',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE known_hosts (
        id TEXT PRIMARY KEY NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        key_type TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        public_key BLOB NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (host, port, key_type)
      );

      CREATE INDEX idx_known_hosts_host_port ON known_hosts (host, port);
    `)
  }
}
