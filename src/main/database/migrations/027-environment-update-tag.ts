import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/** Git tag on the updated commit, for the release notes of an update. */
export const migration027EnvironmentUpdateTag: Migration = {
  version: 27,
  name: '027-environment-update-tag',
  up(db: SqliteDatabase): void {
    db.exec('ALTER TABLE environment_updates ADD COLUMN tag TEXT')
  }
}
