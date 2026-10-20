import { LOCAL_WORKSPACE_ID, type Workspace, type WorkspaceKind } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'

type WorkspaceRow = {
  id: string
  name: string
  kind: WorkspaceKind
  server_url: string | null
  created_at: string
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    serverUrl: row.server_url,
    createdAt: row.created_at
  }
}

/** Workspace registry rows — app-level metadata, not scoped to any workspace. */
export class WorkspacesRepository {
  private readonly listStmt
  private readonly getStmt

  constructor(db: SqliteDatabase) {
    this.listStmt = db.prepare(`
      SELECT id, name, kind, server_url, created_at
      FROM workspaces
      ORDER BY (id = '${LOCAL_WORKSPACE_ID}') DESC, name COLLATE NOCASE, created_at
    `)
    this.getStmt = db.prepare(`
      SELECT id, name, kind, server_url, created_at FROM workspaces WHERE id = ?
    `)
  }

  list(): Workspace[] {
    return (this.listStmt.all() as WorkspaceRow[]).map(mapWorkspace)
  }

  get(id: string): Workspace | null {
    const row = this.getStmt.get(id) as WorkspaceRow | undefined
    return row ? mapWorkspace(row) : null
  }
}
