import type { SqliteDatabase } from '../database/connection'

/**
 * Organization VPN template ↔ the local VPN profile that holds this person's
 * own login for it (REC-023). One profile per template and workspace.
 */
export class OrganizationVpnLinksRepository {
  private readonly getStmt
  private readonly byProfileStmt
  private readonly setStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.getStmt = db.prepare(
      `SELECT vpn_profile_id FROM organization_vpn_links
       WHERE workspace_id = ? AND organization_vpn_id = ?`
    )
    this.byProfileStmt = db.prepare(
      `SELECT organization_vpn_id FROM organization_vpn_links
       WHERE workspace_id = ? AND vpn_profile_id = ?`
    )
    this.setStmt = db.prepare(
      `INSERT INTO organization_vpn_links (workspace_id, organization_vpn_id, vpn_profile_id)
       VALUES (?, ?, ?)
       ON CONFLICT (workspace_id, organization_vpn_id)
       DO UPDATE SET vpn_profile_id = excluded.vpn_profile_id`
    )
    this.deleteStmt = db.prepare(
      'DELETE FROM organization_vpn_links WHERE workspace_id = ? AND organization_vpn_id = ?'
    )
  }

  profileFor(workspaceId: string, organizationVpnId: string): string | null {
    const row = this.getStmt.get(workspaceId, organizationVpnId) as
      | { vpn_profile_id: string }
      | undefined
    return row?.vpn_profile_id ?? null
  }

  /** The template a local profile stands for in this workspace, if any. */
  templateFor(workspaceId: string, profileId: string): string | null {
    const row = this.byProfileStmt.get(workspaceId, profileId) as
      | { organization_vpn_id: string }
      | undefined
    return row?.organization_vpn_id ?? null
  }

  set(workspaceId: string, organizationVpnId: string, profileId: string): void {
    this.setStmt.run(workspaceId, organizationVpnId, profileId)
  }

  delete(workspaceId: string, organizationVpnId: string): void {
    this.deleteStmt.run(workspaceId, organizationVpnId)
  }
}
