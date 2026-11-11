import type { SqliteDatabase } from '../database/connection'

/** This person's SSH key path for each organization connection (never sent to the server). */
export class OrganizationKeyPathsRepository {
  private readonly getStmt
  private readonly setStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.getStmt = db.prepare(
      `SELECT private_key_path FROM organization_key_paths
       WHERE workspace_id = ? AND connection_id = ?`
    )
    this.setStmt = db.prepare(
      `INSERT INTO organization_key_paths (workspace_id, connection_id, private_key_path)
       VALUES (?, ?, ?)
       ON CONFLICT (workspace_id, connection_id)
       DO UPDATE SET private_key_path = excluded.private_key_path`
    )
    this.deleteStmt = db.prepare(
      `DELETE FROM organization_key_paths WHERE workspace_id = ? AND connection_id = ?`
    )
  }

  get(workspaceId: string, connectionId: string): string | null {
    const row = this.getStmt.get(workspaceId, connectionId) as
      | { private_key_path: string }
      | undefined
    return row?.private_key_path ?? null
  }

  /** An empty or null path forgets it. */
  set(workspaceId: string, connectionId: string, path: string | null): void {
    const value = path?.trim()
    if (value) this.setStmt.run(workspaceId, connectionId, value)
    else this.deleteStmt.run(workspaceId, connectionId)
  }
}
