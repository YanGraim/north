import type {
  ChecklistItem,
  Connection,
  ConnectionLink,
  CreateConnectionInput,
  ListConnectionsFilter,
  UpdateConnectionInput
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { boolToInt, intToBool, newId, nowIso, parseJsonArray, toJson } from './row-utils'

type ConnectionRow = {
  id: string
  group_id: string
  name: string
  description: string | null
  protocol: Connection['protocol']
  host: string
  port: number
  username: string | null
  auth_method: Connection['authMethod']
  credential_ref: string | null
  private_key_path: string | null
  jump_host_id: string | null
  default_command: string | null
  notes: string | null
  os: string | null
  icon: string | null
  color: string | null
  owner: string | null
  links: string | null
  vpn_required: number
  checklist: string | null
  related_files: string | null
  is_favorite: number
  access_count: number
  total_connected_ms: number
  last_connected_at: string | null
  created_at: string
  updated_at: string
}

const CONNECTION_COLUMNS = `
  id, group_id, name, description, protocol, host, port, username, auth_method,
  credential_ref, private_key_path, jump_host_id, default_command, notes, os, icon,
  color, owner, links, vpn_required, checklist, related_files, is_favorite,
  access_count, total_connected_ms, last_connected_at, created_at, updated_at
`

function mapConnection(row: ConnectionRow): Connection {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    description: row.description,
    protocol: row.protocol,
    host: row.host,
    port: row.port,
    username: row.username,
    authMethod: row.auth_method,
    credentialRef: row.credential_ref,
    privateKeyPath: row.private_key_path,
    jumpHostId: row.jump_host_id,
    defaultCommand: row.default_command,
    notes: row.notes,
    os: row.os,
    icon: row.icon,
    color: row.color,
    owner: row.owner,
    links: parseJsonArray<ConnectionLink>(row.links),
    vpnRequired: intToBool(row.vpn_required),
    checklist: parseJsonArray<ChecklistItem>(row.checklist),
    relatedFiles: parseJsonArray<string>(row.related_files),
    isFavorite: intToBool(row.is_favorite),
    accessCount: row.access_count,
    totalConnectedMs: row.total_connected_ms,
    lastConnectedAt: row.last_connected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toInsertParams(connection: Connection): Record<string, unknown> {
  return {
    id: connection.id,
    group_id: connection.groupId,
    name: connection.name,
    description: connection.description,
    protocol: connection.protocol,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    auth_method: connection.authMethod,
    credential_ref: connection.credentialRef,
    private_key_path: connection.privateKeyPath,
    jump_host_id: connection.jumpHostId,
    default_command: connection.defaultCommand,
    notes: connection.notes,
    os: connection.os,
    icon: connection.icon,
    color: connection.color,
    owner: connection.owner,
    links: toJson(connection.links),
    vpn_required: boolToInt(connection.vpnRequired),
    checklist: toJson(connection.checklist),
    related_files: toJson(connection.relatedFiles),
    is_favorite: boolToInt(connection.isFavorite),
    access_count: connection.accessCount,
    total_connected_ms: connection.totalConnectedMs,
    last_connected_at: connection.lastConnectedAt,
    created_at: connection.createdAt,
    updated_at: connection.updatedAt
  }
}

export class ConnectionsRepository {
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt
  private readonly toggleFavoriteStmt
  private readonly findByCredentialRefStmt

  constructor(private readonly db: SqliteDatabase) {
    this.getStmt = db.prepare(`
      SELECT ${CONNECTION_COLUMNS}
      FROM connections
      WHERE id = ?
    `)
    this.findByCredentialRefStmt = db.prepare(`
      SELECT ${CONNECTION_COLUMNS}
      FROM connections
      WHERE credential_ref = ?
      LIMIT 1
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO connections (
        id, group_id, name, description, protocol, host, port, username, auth_method,
        credential_ref, private_key_path, jump_host_id, default_command, notes, os, icon,
        color, owner, links, vpn_required, checklist, related_files, is_favorite,
        access_count, total_connected_ms, last_connected_at, created_at, updated_at
      ) VALUES (
        @id, @group_id, @name, @description, @protocol, @host, @port, @username, @auth_method,
        @credential_ref, @private_key_path, @jump_host_id, @default_command, @notes, @os, @icon,
        @color, @owner, @links, @vpn_required, @checklist, @related_files, @is_favorite,
        @access_count, @total_connected_ms, @last_connected_at, @created_at, @updated_at
      )
    `)
    this.updateStmt = db.prepare(`
      UPDATE connections SET
        group_id = @group_id,
        name = @name,
        description = @description,
        protocol = @protocol,
        host = @host,
        port = @port,
        username = @username,
        auth_method = @auth_method,
        credential_ref = @credential_ref,
        private_key_path = @private_key_path,
        jump_host_id = @jump_host_id,
        default_command = @default_command,
        notes = @notes,
        os = @os,
        icon = @icon,
        color = @color,
        owner = @owner,
        links = @links,
        vpn_required = @vpn_required,
        checklist = @checklist,
        related_files = @related_files,
        is_favorite = @is_favorite,
        access_count = @access_count,
        total_connected_ms = @total_connected_ms,
        last_connected_at = @last_connected_at,
        updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM connections WHERE id = ?`)
    this.toggleFavoriteStmt = db.prepare(`
      UPDATE connections
      SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END,
          updated_at = @updated_at
      WHERE id = @id
    `)
  }

  list(filter: ListConnectionsFilter = {}): Connection[] {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filter.groupId) {
      clauses.push('c.group_id = ?')
      params.push(filter.groupId)
    }
    if (filter.environmentId) {
      clauses.push('g.environment_id = ?')
      params.push(filter.environmentId)
    }
    if (filter.clientId) {
      clauses.push('e.client_id = ?')
      params.push(filter.clientId)
    }
    if (filter.isFavorite !== undefined) {
      clauses.push('c.is_favorite = ?')
      params.push(boolToInt(filter.isFavorite))
    }
    if (filter.tagId) {
      clauses.push(`EXISTS (
        SELECT 1 FROM connection_tags ct
        WHERE ct.connection_id = c.id AND ct.tag_id = ?
      )`)
      params.push(filter.tagId)
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    const sql = `
      SELECT ${CONNECTION_COLUMNS.split(',')
        .map((col) => `c.${col.trim()}`)
        .join(', ')}
      FROM connections c
      INNER JOIN groups g ON g.id = c.group_id
      INNER JOIN environments e ON e.id = g.environment_id
      ${where}
      ORDER BY c.name COLLATE NOCASE ASC
    `
    const rows = this.db.prepare(sql).all(...params) as ConnectionRow[]
    return rows.map(mapConnection)
  }

  get(id: string): Connection | null {
    const row = this.getStmt.get(id) as ConnectionRow | undefined
    return row ? mapConnection(row) : null
  }

  findByCredentialRef(credentialRef: string): Connection | null {
    const row = this.findByCredentialRefStmt.get(credentialRef) as ConnectionRow | undefined
    return row ? mapConnection(row) : null
  }

  create(input: CreateConnectionInput): Connection {
    const now = nowIso()
    const connection: Connection = {
      id: newId(),
      groupId: input.groupId,
      name: input.name,
      description: input.description ?? null,
      protocol: input.protocol,
      host: input.host,
      port: input.port,
      username: input.username ?? null,
      authMethod: input.authMethod,
      credentialRef: input.credentialRef ?? null,
      privateKeyPath: input.privateKeyPath ?? null,
      jumpHostId: input.jumpHostId ?? null,
      defaultCommand: input.defaultCommand ?? null,
      notes: input.notes ?? null,
      os: input.os ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      owner: input.owner ?? null,
      links: input.links ?? [],
      vpnRequired: input.vpnRequired ?? false,
      checklist: input.checklist ?? [],
      relatedFiles: input.relatedFiles ?? [],
      isFavorite: input.isFavorite ?? false,
      accessCount: 0,
      totalConnectedMs: 0,
      lastConnectedAt: null,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run(toInsertParams(connection))
    return connection
  }

  update(id: string, input: UpdateConnectionInput): Connection | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    const updated: Connection = {
      ...existing,
      groupId: input.groupId ?? existing.groupId,
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      protocol: input.protocol ?? existing.protocol,
      host: input.host ?? existing.host,
      port: input.port ?? existing.port,
      username: input.username === undefined ? existing.username : input.username,
      authMethod: input.authMethod ?? existing.authMethod,
      credentialRef:
        input.credentialRef === undefined ? existing.credentialRef : input.credentialRef,
      privateKeyPath:
        input.privateKeyPath === undefined ? existing.privateKeyPath : input.privateKeyPath,
      jumpHostId: input.jumpHostId === undefined ? existing.jumpHostId : input.jumpHostId,
      defaultCommand:
        input.defaultCommand === undefined ? existing.defaultCommand : input.defaultCommand,
      notes: input.notes === undefined ? existing.notes : input.notes,
      os: input.os === undefined ? existing.os : input.os,
      icon: input.icon === undefined ? existing.icon : input.icon,
      color: input.color === undefined ? existing.color : input.color,
      owner: input.owner === undefined ? existing.owner : input.owner,
      links: input.links ?? existing.links,
      vpnRequired: input.vpnRequired ?? existing.vpnRequired,
      checklist: input.checklist ?? existing.checklist,
      relatedFiles: input.relatedFiles ?? existing.relatedFiles,
      isFavorite: input.isFavorite ?? existing.isFavorite,
      updatedAt: nowIso()
    }
    this.updateStmt.run(toInsertParams(updated))
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }

  toggleFavorite(id: string): Connection | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    this.toggleFavoriteStmt.run({ id, updated_at: nowIso() })
    return this.get(id)
  }

  duplicate(id: string): Connection | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    const now = nowIso()
    const copy: Connection = {
      ...existing,
      id: newId(),
      name: `${existing.name} (copy)`,
      // Secrets are copied by the IPC handler via the vault (new credentialRef).
      credentialRef: null,
      isFavorite: false,
      accessCount: 0,
      totalConnectedMs: 0,
      lastConnectedAt: null,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run(toInsertParams(copy))
    return copy
  }
}
