import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/** Per-connection ssh-agent forwarding (`ssh -A`), off by default like OpenSSH. */
export const migration019ConnectionAgentForward: Migration = {
  version: 19,
  name: '019-connection-agent-forward',
  up(db: SqliteDatabase): void {
    db.exec(`ALTER TABLE connections ADD COLUMN agent_forward INTEGER NOT NULL DEFAULT 0;`)
  }
}
