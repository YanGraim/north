import type { SqliteDatabase } from '../database/connection'

export type VpnChoiceTarget = 'client' | 'environment' | 'connection' | 'access'

/**
 * Which of this person's VPNs a node of an organization uses (REC-025). Each
 * member chooses for themself; a NULL profile means "no VPN here". Without a
 * choice, the organization's suggestion applies.
 */
export class OrganizationVpnChoicesRepository {
  private readonly getStmt
  private readonly setStmt
  private readonly deleteStmt
  private readonly byProfileStmt

  constructor(db: SqliteDatabase) {
    this.getStmt = db.prepare(
      `SELECT vpn_profile_id FROM organization_vpn_choices
       WHERE workspace_id = ? AND target_type = ? AND target_id = ?`
    )
    this.setStmt = db.prepare(
      `INSERT INTO organization_vpn_choices (workspace_id, target_type, target_id, vpn_profile_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (workspace_id, target_type, target_id)
       DO UPDATE SET vpn_profile_id = excluded.vpn_profile_id`
    )
    this.deleteStmt = db.prepare(
      `DELETE FROM organization_vpn_choices
       WHERE workspace_id = ? AND target_type = ? AND target_id = ?`
    )
    this.byProfileStmt = db.prepare(
      `SELECT target_type, target_id FROM organization_vpn_choices
       WHERE workspace_id = ? AND vpn_profile_id = ? ORDER BY target_type, target_id`
    )
  }

  /** undefined: no choice yet; null: chose no VPN. */
  get(workspaceId: string, target: VpnChoiceTarget, id: string): string | null | undefined {
    const row = this.getStmt.get(workspaceId, target, id) as
      | { vpn_profile_id: string | null }
      | undefined
    return row ? row.vpn_profile_id : undefined
  }

  set(workspaceId: string, target: VpnChoiceTarget, id: string, profileId: string | null): void {
    this.setStmt.run(workspaceId, target, id, profileId)
  }

  clear(workspaceId: string, target: VpnChoiceTarget, id: string): void {
    this.deleteStmt.run(workspaceId, target, id)
  }

  usedBy(workspaceId: string, profileId: string): Array<{ target: VpnChoiceTarget; id: string }> {
    return (
      this.byProfileStmt.all(workspaceId, profileId) as Array<{
        target_type: VpnChoiceTarget
        target_id: string
      }>
    ).map((r) => ({ target: r.target_type, id: r.target_id }))
  }
}
