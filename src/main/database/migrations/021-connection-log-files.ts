import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/** JSON list of remote log files an SSH connection can follow. Null means none. */
export const migration021ConnectionLogFiles: Migration = {
  version: 21,
  name: '021-connection-log-files',
  up(db: SqliteDatabase): void {
    db.exec(`ALTER TABLE connections ADD COLUMN log_files TEXT;`)
  }
}
