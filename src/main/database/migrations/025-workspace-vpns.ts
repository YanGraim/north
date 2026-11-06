import { randomUUID } from 'node:crypto'
import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * VPNs per workspace, choices per person (REC-025). Each workspace has its own
 * VPN list on this computer; in an organization, which VPN a client,
 * environment, connection or access uses is this person's own choice
 * (`organization_vpn_choices`), and the server only keeps a suggestion for
 * whoever has not chosen yet. Profiles an organization already used are
 * cloned into it, logins included, so both workspaces keep working.
 */
export const migration025WorkspaceVpns: Migration = {
  version: 25,
  name: '025-workspace-vpns',
  up(db: SqliteDatabase): void {
    db.exec(`
      ALTER TABLE vpn_profiles ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'local';
      CREATE INDEX idx_vpn_profiles_workspace ON vpn_profiles(workspace_id);

      CREATE TABLE organization_vpn_choices (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL CHECK (target_type IN ('client', 'environment', 'connection', 'access')),
        target_id TEXT NOT NULL,
        -- NULL: this person chose "no VPN" here
        vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE CASCADE,
        PRIMARY KEY (workspace_id, target_type, target_id)
      );
    `)

    const links = db
      .prepare(
        'SELECT workspace_id, organization_vpn_id, vpn_profile_id FROM organization_vpn_links'
      )
      .all() as Array<{ workspace_id: string; organization_vpn_id: string; vpn_profile_id: string }>
    const clones = new Map<string, string>()
    for (const link of links) {
      const key = `${link.workspace_id}:${link.vpn_profile_id}`
      let clone = clones.get(key)
      if (!clone) {
        const made = cloneVpnProfile(db, link.vpn_profile_id, link.workspace_id)
        if (!made) continue
        clone = made
        clones.set(key, clone)
      }
      db.prepare(
        'UPDATE organization_vpn_links SET vpn_profile_id = ? WHERE workspace_id = ? AND organization_vpn_id = ?'
      ).run(clone, link.workspace_id, link.organization_vpn_id)
    }
  }
}

/** Copies a profile and its saved logins (same ciphertext, new vault rows) into a workspace. */
export function cloneVpnProfile(
  db: SqliteDatabase,
  profileId: string,
  workspaceId: string
): string | null {
  const source = db.prepare('SELECT * FROM vpn_profiles WHERE id = ?').get(profileId) as
    | Record<string, unknown>
    | undefined
  if (!source) return null
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO vpn_profiles
       (id, client_id, name, kind, config, auto_disconnect, idle_timeout_sec, notes,
        created_at, updated_at, workspace_id)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    source.name,
    source.kind,
    source.config,
    source.auto_disconnect,
    source.idle_timeout_sec,
    source.notes,
    now,
    now,
    workspaceId
  )
  const secrets = db
    .prepare('SELECT kind, credential_ref FROM vpn_secrets WHERE vpn_profile_id = ?')
    .all(profileId) as Array<{ kind: string; credential_ref: string }>
  for (const secret of secrets) {
    const credential = db
      .prepare('SELECT ciphertext FROM credentials WHERE id = ?')
      .get(secret.credential_ref) as { ciphertext: Buffer } | undefined
    if (!credential) continue
    const ref = randomUUID()
    db.prepare(
      'INSERT INTO credentials (id, ciphertext, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(ref, credential.ciphertext, now, now)
    db.prepare(
      'INSERT INTO vpn_secrets (vpn_profile_id, kind, credential_ref) VALUES (?, ?, ?)'
    ).run(id, secret.kind, ref)
  }
  return id
}
