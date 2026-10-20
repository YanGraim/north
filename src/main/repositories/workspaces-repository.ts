import { randomBytes } from 'node:crypto'
import { LOCAL_WORKSPACE_ID, type Workspace, type WorkspaceKind } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { nowIso } from './row-utils'

type WorkspaceRow = {
  id: string
  name: string
  kind: WorkspaceKind
  server_url: string | null
  user_email: string | null
  created_at: string
}

const COLUMNS = 'id, name, kind, server_url, user_email, created_at'

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    serverUrl: row.server_url,
    userEmail: row.user_email,
    createdAt: row.created_at
  }
}

/** `Acme Corp` → `acme-corp-x7k2`: URL-safe, readable, unique enough per machine. */
function slugId(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const suffix = randomBytes(3).toString('hex').slice(0, 4)
  return `${base || 'org'}-${suffix}`
}

/** Workspace registry rows — app-level metadata, not scoped to any workspace. */
export class WorkspacesRepository {
  private readonly listStmt
  private readonly getStmt
  private readonly byServerStmt
  private readonly insertStmt
  private readonly deleteStmt
  private readonly setRefStmt
  private readonly getRefStmt
  private readonly setEmailStmt

  constructor(db: SqliteDatabase) {
    this.listStmt = db.prepare(`
      SELECT ${COLUMNS} FROM workspaces
      ORDER BY (id = '${LOCAL_WORKSPACE_ID}') DESC, name COLLATE NOCASE, created_at
    `)
    this.getStmt = db.prepare(`SELECT ${COLUMNS} FROM workspaces WHERE id = ?`)
    this.byServerStmt = db.prepare(
      `SELECT ${COLUMNS} FROM workspaces WHERE kind = 'organization' AND server_url = ?`
    )
    this.insertStmt = db.prepare(`
      INSERT INTO workspaces (id, name, kind, server_url, user_email, created_at)
      VALUES (?, ?, 'organization', ?, ?, ?)
    `)
    this.deleteStmt = db.prepare(`DELETE FROM workspaces WHERE id = ? AND kind = 'organization'`)
    this.setRefStmt = db.prepare(`UPDATE workspaces SET refresh_credential_ref = ? WHERE id = ?`)
    this.getRefStmt = db.prepare(
      `SELECT refresh_credential_ref AS ref FROM workspaces WHERE id = ?`
    )
    this.setEmailStmt = db.prepare(`UPDATE workspaces SET user_email = ? WHERE id = ?`)
  }

  list(): Workspace[] {
    return (this.listStmt.all() as WorkspaceRow[]).map(mapWorkspace)
  }

  get(id: string): Workspace | null {
    const row = this.getStmt.get(id) as WorkspaceRow | undefined
    return row ? mapWorkspace(row) : null
  }

  findByServerUrl(serverUrl: string): Workspace | null {
    const row = this.byServerStmt.get(serverUrl) as WorkspaceRow | undefined
    return row ? mapWorkspace(row) : null
  }

  createOrganization(input: {
    name: string
    serverUrl: string
    userEmail: string | null
  }): Workspace {
    const id = slugId(input.name)
    this.insertStmt.run(id, input.name, input.serverUrl, input.userEmail, nowIso())
    return this.get(id) as Workspace
  }

  setUserEmail(id: string, email: string | null): void {
    this.setEmailStmt.run(email, id)
  }

  setRefreshCredentialRef(id: string, ref: string | null): void {
    this.setRefStmt.run(ref, id)
  }

  refreshCredentialRef(id: string): string | null {
    return (this.getRefStmt.get(id) as { ref: string | null } | undefined)?.ref ?? null
  }

  /** Organizations only — the personal workspace cannot be deleted. */
  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }
}
