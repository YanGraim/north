import type {
  Access,
  ConnectionLink,
  CreateAccessInput,
  ListAccessesFilter,
  UpdateAccessInput
} from '@shared/types'
import { ApiConfigSchema, emptyApiConfig } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { boolToInt, intToBool, newId, nowIso, parseJsonArray, toJson } from './row-utils'

type AccessRow = {
  id: string
  group_id: string
  type: Access['type']
  name: string
  description: string | null
  notes: string | null
  username: string | null
  credential_ref: string | null
  url: string | null
  links: string | null
  icon: string | null
  color: string | null
  is_favorite: number
  engine: Access['engine']
  host: string | null
  port: number | null
  database_name: string | null
  ssl: number | null
  api_config: string | null
  created_at: string
  updated_at: string
}

const ACCESS_COLUMNS = `
  id, group_id, type, name, description, notes, username, credential_ref, url, links,
  icon, color, is_favorite, engine, host, port, database_name, ssl, api_config, created_at, updated_at
`

function parseApiConfig(raw: string | null, type: Access['type']): Access['apiConfig'] {
  if (!raw) {
    return type === 'api' ? emptyApiConfig() : null
  }
  try {
    return ApiConfigSchema.parse(JSON.parse(raw))
  } catch {
    return type === 'api' ? emptyApiConfig() : null
  }
}

function mapAccess(row: AccessRow): Access {
  return {
    id: row.id,
    groupId: row.group_id,
    type: row.type,
    name: row.name,
    description: row.description,
    notes: row.notes,
    username: row.username,
    credentialRef: row.credential_ref,
    url: row.url,
    links: parseJsonArray<ConnectionLink>(row.links),
    icon: row.icon,
    color: row.color,
    isFavorite: intToBool(row.is_favorite),
    engine: row.engine,
    host: row.host,
    port: row.port,
    database: row.database_name,
    ssl: row.ssl === null ? null : intToBool(row.ssl),
    apiConfig: parseApiConfig(row.api_config, row.type),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toInsertParams(access: Access): Record<string, unknown> {
  return {
    id: access.id,
    group_id: access.groupId,
    type: access.type,
    name: access.name,
    description: access.description,
    notes: access.notes,
    username: access.username,
    credential_ref: access.credentialRef,
    url: access.url,
    links: toJson(access.links),
    icon: access.icon,
    color: access.color,
    is_favorite: boolToInt(access.isFavorite),
    engine: access.engine,
    host: access.host,
    port: access.port,
    database_name: access.database,
    ssl: access.ssl === null ? null : boolToInt(access.ssl),
    api_config: access.apiConfig ? JSON.stringify(access.apiConfig) : null,
    created_at: access.createdAt,
    updated_at: access.updatedAt
  }
}

export class AccessesRepository {
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt
  private readonly toggleFavoriteStmt
  private readonly findByCredentialRefStmt

  constructor(private readonly db: SqliteDatabase) {
    this.getStmt = db.prepare(`
      SELECT ${ACCESS_COLUMNS}
      FROM accesses
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO accesses (
        id, group_id, type, name, description, notes, username, credential_ref, url, links,
        icon, color, is_favorite, engine, host, port, database_name, ssl, api_config, created_at, updated_at
      ) VALUES (
        @id, @group_id, @type, @name, @description, @notes, @username, @credential_ref, @url, @links,
        @icon, @color, @is_favorite, @engine, @host, @port, @database_name, @ssl, @api_config, @created_at, @updated_at
      )
    `)
    this.updateStmt = db.prepare(`
      UPDATE accesses SET
        group_id = @group_id,
        type = @type,
        name = @name,
        description = @description,
        notes = @notes,
        username = @username,
        credential_ref = @credential_ref,
        url = @url,
        links = @links,
        icon = @icon,
        color = @color,
        is_favorite = @is_favorite,
        engine = @engine,
        host = @host,
        port = @port,
        database_name = @database_name,
        ssl = @ssl,
        api_config = @api_config,
        updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM accesses WHERE id = ?`)
    this.toggleFavoriteStmt = db.prepare(`
      UPDATE accesses
      SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END,
          updated_at = @updated_at
      WHERE id = @id
    `)
    this.findByCredentialRefStmt = db.prepare(`
      SELECT ${ACCESS_COLUMNS}
      FROM accesses
      WHERE credential_ref = ?
      LIMIT 1
    `)
  }

  list(filter: ListAccessesFilter = {}): Access[] {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filter.groupId) {
      clauses.push('a.group_id = ?')
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
      clauses.push('a.is_favorite = ?')
      params.push(boolToInt(filter.isFavorite))
    }
    if (filter.type) {
      clauses.push('a.type = ?')
      params.push(filter.type)
    }
    if (filter.tagId) {
      clauses.push(`EXISTS (
        SELECT 1 FROM access_tags at
        WHERE at.access_id = a.id AND at.tag_id = ?
      )`)
      params.push(filter.tagId)
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    const sql = `
      SELECT ${ACCESS_COLUMNS.split(',')
        .map((col) => `a.${col.trim()}`)
        .join(', ')}
      FROM accesses a
      INNER JOIN groups g ON g.id = a.group_id
      INNER JOIN environments e ON e.id = g.environment_id
      ${where}
      ORDER BY a.name COLLATE NOCASE ASC
    `
    const rows = this.db.prepare(sql).all(...params) as AccessRow[]
    return rows.map(mapAccess)
  }

  get(id: string): Access | null {
    const row = this.getStmt.get(id) as AccessRow | undefined
    return row ? mapAccess(row) : null
  }

  findByCredentialRef(credentialRef: string): Access | null {
    const row = this.findByCredentialRefStmt.get(credentialRef) as AccessRow | undefined
    return row ? mapAccess(row) : null
  }

  create(input: CreateAccessInput): Access {
    const now = nowIso()
    const access: Access = {
      id: newId(),
      groupId: input.groupId,
      type: input.type,
      name: input.name,
      description: input.description ?? null,
      notes: input.notes ?? null,
      username: input.username ?? null,
      credentialRef: input.credentialRef ?? null,
      url: input.url ?? null,
      links: input.links ?? [],
      icon: input.icon ?? null,
      color: input.color ?? null,
      isFavorite: input.isFavorite ?? false,
      engine: input.engine ?? null,
      host: input.host ?? null,
      port: input.port ?? null,
      database: input.database ?? null,
      ssl: input.ssl ?? null,
      apiConfig:
        input.apiConfig !== undefined
          ? input.apiConfig
          : input.type === 'api'
            ? emptyApiConfig()
            : null,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run(toInsertParams(access))
    return access
  }

  update(id: string, input: UpdateAccessInput): Access | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    const updated: Access = {
      ...existing,
      groupId: input.groupId ?? existing.groupId,
      type: input.type ?? existing.type,
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      notes: input.notes === undefined ? existing.notes : input.notes,
      username: input.username === undefined ? existing.username : input.username,
      credentialRef:
        input.credentialRef === undefined ? existing.credentialRef : input.credentialRef,
      url: input.url === undefined ? existing.url : input.url,
      links: input.links ?? existing.links,
      icon: input.icon === undefined ? existing.icon : input.icon,
      color: input.color === undefined ? existing.color : input.color,
      isFavorite: input.isFavorite ?? existing.isFavorite,
      engine: input.engine === undefined ? existing.engine : input.engine,
      host: input.host === undefined ? existing.host : input.host,
      port: input.port === undefined ? existing.port : input.port,
      database: input.database === undefined ? existing.database : input.database,
      ssl: input.ssl === undefined ? existing.ssl : input.ssl,
      apiConfig: input.apiConfig === undefined ? existing.apiConfig : input.apiConfig,
      updatedAt: nowIso()
    }
    this.updateStmt.run(toInsertParams(updated))
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }

  toggleFavorite(id: string): Access | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    this.toggleFavoriteStmt.run({ id, updated_at: nowIso() })
    return this.get(id)
  }
}
