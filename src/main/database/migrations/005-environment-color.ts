import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/** Optional accent color for environments (prod/homolog/dev UI). */
export const migration005EnvironmentColor: Migration = {
  version: 5,
  name: '005-environment-color',
  up(db: SqliteDatabase): void {
    db.exec(`ALTER TABLE environments ADD COLUMN color TEXT`)
  }
}
