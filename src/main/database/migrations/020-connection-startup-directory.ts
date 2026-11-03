import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/** Optional remote directory an SSH connection opens in. Null keeps today's login directory. */
export const migration020ConnectionStartupDirectory: Migration = {
  version: 20,
  name: '020-connection-startup-directory',
  up(db: SqliteDatabase): void {
    db.exec(`ALTER TABLE connections ADD COLUMN startup_directory TEXT;`)
  }
}
