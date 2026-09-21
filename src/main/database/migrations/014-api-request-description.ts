import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/** Free-text notes on an API request — separate from the collection-level description. */
export const migration014ApiRequestDescription: Migration = {
  version: 14,
  name: '014-api-request-description',
  up(db: SqliteDatabase): void {
    db.exec(`ALTER TABLE api_requests ADD COLUMN description TEXT;`)
  }
}
