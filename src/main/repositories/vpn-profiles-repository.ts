import {
  type CreateVpnProfileInput,
  type UpdateVpnProfileInput,
  VpnConfigSchema,
  type VpnProfile
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { cloneVpnProfile } from '../database/migrations/025-workspace-vpns'
import { newId, nowIso } from './row-utils'

type VpnProfileRow = {
  id: string
  client_id: string | null
  name: string
  kind: string
  config: string
  auto_disconnect: string
  idle_timeout_sec: number
  notes: string | null
  created_at: string
  updated_at: string
  workspace_id: string
}

const COLUMNS = `id, client_id, name, kind, config, auto_disconnect, idle_timeout_sec, notes, created_at, updated_at, workspace_id`

const LOCAL = 'local'

function mapProfile(row: VpnProfileRow): VpnProfile {
  const config = VpnConfigSchema.parse(JSON.parse(row.config))
  return {
    id: row.id,
    clientId: row.client_id,
    workspaceId: row.workspace_id,
    name: row.name,
    kind: config.kind,
    config,
    autoDisconnect: row.auto_disconnect === 'never' ? 'never' : 'when-idle',
    idleTimeoutSec: row.idle_timeout_sec,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toRow(profile: VpnProfile): VpnProfileRow {
  return {
    id: profile.id,
    client_id: profile.clientId,
    name: profile.name,
    kind: profile.config.kind,
    config: JSON.stringify(profile.config),
    auto_disconnect: profile.autoDisconnect,
    idle_timeout_sec: profile.idleTimeoutSec,
    notes: profile.notes,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    workspace_id: profile.workspaceId ?? LOCAL
  }
}

export class VpnProfilesRepository {
  private readonly listStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt
  private readonly setClientLinkStmt
  private readonly setEnvironmentLinkStmt
  private readonly clientLinksStmt
  private readonly environmentLinksStmt
  private readonly clientLinkStmt
  private readonly environmentLinkStmt
  private readonly localClientStmt

  constructor(private readonly db: SqliteDatabase) {
    this.localClientStmt = db.prepare('SELECT 1 FROM clients WHERE id = ?')
    this.listStmt = db.prepare(
      `SELECT ${COLUMNS} FROM vpn_profiles ORDER BY name COLLATE NOCASE ASC`
    )
    this.getStmt = db.prepare(`SELECT ${COLUMNS} FROM vpn_profiles WHERE id = ?`)
    this.insertStmt = db.prepare(`
      INSERT INTO vpn_profiles (${COLUMNS})
      VALUES (@id, @client_id, @name, @kind, @config, @auto_disconnect, @idle_timeout_sec, @notes, @created_at, @updated_at, @workspace_id)
    `)
    this.updateStmt = db.prepare(`
      UPDATE vpn_profiles
      SET client_id = @client_id, name = @name, kind = @kind, config = @config,
          auto_disconnect = @auto_disconnect, idle_timeout_sec = @idle_timeout_sec,
          notes = @notes, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM vpn_profiles WHERE id = ?`)
    this.setClientLinkStmt = db.prepare(`UPDATE clients SET vpn_profile_id = ? WHERE id = ?`)
    this.setEnvironmentLinkStmt = db.prepare(
      `UPDATE environments SET vpn_profile_id = ? WHERE id = ?`
    )
    this.clientLinkStmt = db.prepare(`SELECT vpn_profile_id FROM clients WHERE id = ?`)
    this.environmentLinkStmt = db.prepare(
      `SELECT vpn_profile_id, client_id FROM environments WHERE id = ?`
    )
    this.clientLinksStmt = db.prepare(`SELECT id FROM clients WHERE vpn_profile_id = ? ORDER BY id`)
    this.environmentLinksStmt = db.prepare(
      `SELECT id FROM environments WHERE vpn_profile_id = ? ORDER BY id`
    )
  }

  /** Every profile on this computer, or only one workspace's VPN list. */
  list(workspaceId?: string): VpnProfile[] {
    const all = (this.listStmt.all() as VpnProfileRow[]).map(mapProfile)
    return workspaceId === undefined ? all : all.filter((p) => p.workspaceId === workspaceId)
  }

  /** A copy (logins included) in another workspace's VPN list. */
  clone(id: string, workspaceId: string): VpnProfile | null {
    const cloned = this.db.transaction(() => cloneVpnProfile(this.db, id, workspaceId))()
    return cloned ? this.get(cloned) : null
  }

  get(id: string): VpnProfile | null {
    const row = this.getStmt.get(id) as VpnProfileRow | undefined
    return row ? mapProfile(row) : null
  }

  /**
   * A profile belongs to this computer. Picked while in an organization, its
   * "client" is a server id with no row here: keep the profile, drop the label.
   */
  private localClient(clientId: string | null | undefined): string | null {
    return clientId && this.localClientStmt.get(clientId) ? clientId : null
  }

  create(input: CreateVpnProfileInput, workspaceId = LOCAL): VpnProfile {
    const now = nowIso()
    const profile: VpnProfile = {
      id: newId(),
      // an organization's clients live on its server: no local row to point at
      clientId: workspaceId === LOCAL ? this.localClient(input.clientId) : null,
      workspaceId,
      name: input.name,
      kind: input.config.kind,
      config: input.config,
      autoDisconnect: input.autoDisconnect ?? 'when-idle',
      idleTimeoutSec: input.idleTimeoutSec ?? 300,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run(toRow(profile))
    return profile
  }

  update(id: string, input: UpdateVpnProfileInput): VpnProfile | null {
    const existing = this.get(id)
    if (!existing) return null
    const config = input.config ?? existing.config
    const next: VpnProfile = {
      ...existing,
      clientId:
        input.clientId === undefined || (existing.workspaceId ?? LOCAL) !== LOCAL
          ? existing.clientId
          : this.localClient(input.clientId),
      name: input.name ?? existing.name,
      kind: config.kind,
      config,
      autoDisconnect: input.autoDisconnect ?? existing.autoDisconnect,
      idleTimeoutSec: input.idleTimeoutSec ?? existing.idleTimeoutSec,
      notes: input.notes === undefined ? existing.notes : input.notes,
      updatedAt: nowIso()
    }
    this.updateStmt.run(toRow(next))
    return next
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }

  setClientLink(clientId: string, profileId: string | null): void {
    this.setClientLinkStmt.run(profileId, clientId)
  }

  setEnvironmentLink(environmentId: string, profileId: string | null): void {
    this.setEnvironmentLinkStmt.run(profileId, environmentId)
  }

  getLinks(profileId: string): { clientIds: string[]; environmentIds: string[] } {
    return {
      clientIds: (this.clientLinksStmt.all(profileId) as Array<{ id: string }>).map((r) => r.id),
      environmentIds: (this.environmentLinksStmt.all(profileId) as Array<{ id: string }>).map(
        (r) => r.id
      )
    }
  }

  /** The VPN an Environment inherits: its own link, else its Client's. */
  linkForEnvironment(environmentId: string): { environment: string | null; client: string | null } {
    const env = this.environmentLinkStmt.get(environmentId) as
      | { vpn_profile_id: string | null; client_id: string }
      | undefined
    if (!env) return { environment: null, client: null }
    const client = this.clientLinkStmt.get(env.client_id) as
      | { vpn_profile_id: string | null }
      | undefined
    return { environment: env.vpn_profile_id, client: client?.vpn_profile_id ?? null }
  }

  linkForClient(clientId: string): string | null {
    const row = this.clientLinkStmt.get(clientId) as { vpn_profile_id: string | null } | undefined
    return row?.vpn_profile_id ?? null
  }
}
