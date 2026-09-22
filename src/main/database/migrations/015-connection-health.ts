import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Opt-in uptime monitoring for Connections (SSH/RDP/VNC/FTP/SFTP/Telnet) —
 * a lightweight TCP-reachability check, not metrics/agent-based monitoring.
 * `connection_monitors` is a 1:1 bag keyed by connection_id (same pattern as
 * `connection_secrets`); `connection_health_events` only records status
 * *transitions* (up→down / down→up), not every poll — mirrors
 * `environment_updates`'s event-log shape rather than a time series.
 */
export const migration015ConnectionHealth: Migration = {
  version: 15,
  name: '015-connection-health',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE connection_monitors (
        connection_id TEXT PRIMARY KEY NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 0,
        last_status TEXT,
        last_checked_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE connection_health_events (
        id TEXT PRIMARY KEY NOT NULL,
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        latency_ms INTEGER,
        error_message TEXT
      );
      CREATE INDEX idx_connection_health_events_connection_id
        ON connection_health_events(connection_id, occurred_at DESC);
    `)
  }
}
