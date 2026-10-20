import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Organization sign-in (ADR 0018, phase 2). The refresh token lives in the
 * vault (`credentials`); the row only keeps its ref and who signed in.
 */
export const migration018WorkspaceSessions: Migration = {
  version: 18,
  name: '018-workspace-sessions',
  up(db: SqliteDatabase): void {
    db.exec(`
      ALTER TABLE workspaces ADD COLUMN user_email TEXT;
      ALTER TABLE workspaces ADD COLUMN refresh_credential_ref TEXT;
    `)
  }
}
