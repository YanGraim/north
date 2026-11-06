import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Which local VPN profile stands for each VPN an organization shares
 * (REC-023). The organization keeps only the gateway; the profile here holds
 * this person's own login, so every member signs in to the VPN as themself.
 */
export const migration023OrganizationVpnLinks: Migration = {
  version: 23,
  name: '023-organization-vpn-links',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE organization_vpn_links (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        organization_vpn_id TEXT NOT NULL,
        vpn_profile_id TEXT NOT NULL REFERENCES vpn_profiles(id) ON DELETE CASCADE,
        PRIMARY KEY (workspace_id, organization_vpn_id)
      );

      CREATE INDEX idx_organization_vpn_links_profile
        ON organization_vpn_links(vpn_profile_id);
    `)
  }
}
