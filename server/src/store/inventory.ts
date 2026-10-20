import { randomUUID } from 'node:crypto'
import type {
  Client,
  Connection,
  CreateClientInput,
  CreateConnectionInput,
  CreateEnvironmentInput,
  CreateGroupInput,
  CreateTagInput,
  Environment,
  Group,
  ListConnectionsFilter,
  Tag,
  UpdateClientInput,
  UpdateConnectionInput,
  UpdateEnvironmentInput,
  UpdateGroupInput,
  UpdateTagInput
} from '@shared/types'
import type { Db } from '../db'
import { ApiError, notFound } from '../errors'

type Row = Record<string, unknown>

const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString()

/** `{ name: 'x', sortOrder: 1 }` → `name = $2, sort_order = $3` (after the id param). */
function setClause(
  input: Record<string, unknown>,
  columns: Record<string, string>,
  json: ReadonlySet<string> = new Set()
): { sql: string; params: unknown[] } {
  const parts: string[] = []
  const params: unknown[] = []
  for (const [key, column] of Object.entries(columns)) {
    if (input[key] === undefined) continue
    params.push(json.has(key) ? JSON.stringify(input[key]) : input[key])
    parts.push(`${column} = $${params.length + 1}`)
  }
  parts.push('updated_at = now()')
  return { sql: parts.join(', '), params }
}

// ── clients ────────────────────────────────────────────────────────────────

const mapClient = (r: Row): Client => ({
  id: r.id as string,
  name: r.name as string,
  notes: (r.notes as string | null) ?? null,
  color: (r.color as string | null) ?? null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at)
})

export async function listClients(db: Db): Promise<Client[]> {
  const { rows } = await db.query('SELECT * FROM clients ORDER BY lower(name), created_at')
  return rows.map(mapClient)
}

export async function getClient(db: Db, id: string): Promise<Client | null> {
  const { rows } = await db.query('SELECT * FROM clients WHERE id = $1', [id])
  return rows[0] ? mapClient(rows[0]) : null
}

export async function createClient(db: Db, input: CreateClientInput): Promise<Client> {
  const { rows } = await db.query(
    'INSERT INTO clients (id, name, notes, color) VALUES ($1, $2, $3, $4) RETURNING *',
    [randomUUID(), input.name, input.notes ?? null, input.color ?? null]
  )
  return mapClient(rows[0])
}

export async function updateClient(
  db: Db,
  id: string,
  input: UpdateClientInput
): Promise<Client | null> {
  const set = setClause(input, { name: 'name', notes: 'notes', color: 'color' })
  const { rows } = await db.query(`UPDATE clients SET ${set.sql} WHERE id = $1 RETURNING *`, [
    id,
    ...set.params
  ])
  return rows[0] ? mapClient(rows[0]) : null
}

export async function deleteClient(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

// ── environments ───────────────────────────────────────────────────────────

const mapEnvironment = (r: Row): Environment => ({
  id: r.id as string,
  clientId: r.client_id as string,
  name: r.name as string,
  notes: (r.notes as string | null) ?? null,
  color: (r.color as string | null) ?? null,
  sortOrder: Number(r.sort_order),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at)
})

export async function listEnvironments(db: Db, clientId?: string): Promise<Environment[]> {
  const { rows } = clientId
    ? await db.query(
        'SELECT * FROM environments WHERE client_id = $1 ORDER BY sort_order, lower(name)',
        [clientId]
      )
    : await db.query('SELECT * FROM environments ORDER BY sort_order, lower(name)')
  return rows.map(mapEnvironment)
}

export async function getEnvironment(db: Db, id: string): Promise<Environment | null> {
  const { rows } = await db.query('SELECT * FROM environments WHERE id = $1', [id])
  return rows[0] ? mapEnvironment(rows[0]) : null
}

export async function createEnvironment(
  db: Db,
  input: CreateEnvironmentInput
): Promise<Environment> {
  if (!(await getClient(db, input.clientId))) throw notFound('Client')
  const { rows } = await db.query(
    `INSERT INTO environments (id, client_id, name, notes, color, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      randomUUID(),
      input.clientId,
      input.name,
      input.notes ?? null,
      input.color ?? null,
      input.sortOrder ?? 0
    ]
  )
  return mapEnvironment(rows[0])
}

export async function updateEnvironment(
  db: Db,
  id: string,
  input: UpdateEnvironmentInput
): Promise<Environment | null> {
  const set = setClause(input, {
    name: 'name',
    notes: 'notes',
    color: 'color',
    sortOrder: 'sort_order'
  })
  const { rows } = await db.query(`UPDATE environments SET ${set.sql} WHERE id = $1 RETURNING *`, [
    id,
    ...set.params
  ])
  return rows[0] ? mapEnvironment(rows[0]) : null
}

export async function deleteEnvironment(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM environments WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

// ── groups ─────────────────────────────────────────────────────────────────

const mapGroup = (r: Row): Group => ({
  id: r.id as string,
  environmentId: r.environment_id as string,
  name: r.name as string,
  notes: (r.notes as string | null) ?? null,
  sortOrder: Number(r.sort_order),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at)
})

export async function listGroups(db: Db, environmentId?: string): Promise<Group[]> {
  const { rows } = environmentId
    ? await db.query(
        'SELECT * FROM groups WHERE environment_id = $1 ORDER BY sort_order, lower(name)',
        [environmentId]
      )
    : await db.query('SELECT * FROM groups ORDER BY sort_order, lower(name)')
  return rows.map(mapGroup)
}

export async function getGroup(db: Db, id: string): Promise<Group | null> {
  const { rows } = await db.query('SELECT * FROM groups WHERE id = $1', [id])
  return rows[0] ? mapGroup(rows[0]) : null
}

export async function createGroup(db: Db, input: CreateGroupInput): Promise<Group> {
  if (!(await getEnvironment(db, input.environmentId))) throw notFound('Environment')
  const { rows } = await db.query(
    `INSERT INTO groups (id, environment_id, name, notes, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [randomUUID(), input.environmentId, input.name, input.notes ?? null, input.sortOrder ?? 0]
  )
  return mapGroup(rows[0])
}

export async function updateGroup(
  db: Db,
  id: string,
  input: UpdateGroupInput
): Promise<Group | null> {
  const set = setClause(input, { name: 'name', notes: 'notes', sortOrder: 'sort_order' })
  const { rows } = await db.query(`UPDATE groups SET ${set.sql} WHERE id = $1 RETURNING *`, [
    id,
    ...set.params
  ])
  return rows[0] ? mapGroup(rows[0]) : null
}

export async function deleteGroup(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM groups WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

// ── connections ────────────────────────────────────────────────────────────

/**
 * Shared columns only. `privateKeyPath` and `vpnProfileId` point at things on
 * one person's machine (key file, local VPN), so the organization never stores
 * them; usage stats are per user (later). `credentialRef` is the id of a
 * server-side secret (see store/secrets).
 */
const CONNECTION_COLUMNS: Record<string, string> = {
  name: 'name',
  description: 'description',
  protocol: 'protocol',
  host: 'host',
  port: 'port',
  username: 'username',
  authMethod: 'auth_method',
  credentialRef: 'credential_ref',
  jumpHostId: 'jump_host_id',
  defaultCommand: 'default_command',
  notes: 'notes',
  os: 'os',
  icon: 'icon',
  color: 'color',
  owner: 'owner',
  links: 'links',
  vpnRequired: 'vpn_required',
  vpnMode: 'vpn_mode',
  checklist: 'checklist',
  relatedFiles: 'related_files'
}
const JSON_COLUMNS = new Set(['links', 'checklist', 'relatedFiles'])

const mapConnection = (r: Row): Connection => ({
  id: r.id as string,
  groupId: r.group_id as string,
  name: r.name as string,
  description: (r.description as string | null) ?? null,
  protocol: r.protocol as Connection['protocol'],
  host: r.host as string,
  port: Number(r.port),
  username: (r.username as string | null) ?? null,
  authMethod: r.auth_method as Connection['authMethod'],
  credentialRef: (r.credential_ref as string | null) ?? null,
  privateKeyPath: null,
  jumpHostId: (r.jump_host_id as string | null) ?? null,
  defaultCommand: (r.default_command as string | null) ?? null,
  notes: (r.notes as string | null) ?? null,
  os: (r.os as string | null) ?? null,
  icon: (r.icon as string | null) ?? null,
  color: (r.color as string | null) ?? null,
  owner: (r.owner as string | null) ?? null,
  links: (r.links as Connection['links']) ?? [],
  vpnRequired: Boolean(r.vpn_required),
  vpnMode: r.vpn_mode as Connection['vpnMode'],
  vpnProfileId: null,
  checklist: (r.checklist as Connection['checklist']) ?? [],
  relatedFiles: (r.related_files as string[]) ?? [],
  isFavorite: Boolean(r.is_favorite),
  accessCount: 0,
  totalConnectedMs: 0,
  lastConnectedAt: null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at)
})

const SELECT_CONNECTION = `
  SELECT c.*, (f.user_id IS NOT NULL) AS is_favorite
  FROM connections c
  INNER JOIN groups g ON g.id = c.group_id
  INNER JOIN environments e ON e.id = g.environment_id
  LEFT JOIN user_favorites f ON f.connection_id = c.id AND f.user_id = $1
`

export async function listConnections(
  db: Db,
  userId: string,
  filter: ListConnectionsFilter = {}
): Promise<Connection[]> {
  const clauses: string[] = []
  const params: unknown[] = [userId]
  const add = (sql: string, value: unknown): void => {
    params.push(value)
    clauses.push(sql.replace('?', `$${params.length}`))
  }
  if (filter.groupId) add('c.group_id = ?', filter.groupId)
  if (filter.environmentId) add('g.environment_id = ?', filter.environmentId)
  if (filter.clientId) add('e.client_id = ?', filter.clientId)
  if (filter.isFavorite !== undefined) {
    clauses.push(filter.isFavorite ? 'f.user_id IS NOT NULL' : 'f.user_id IS NULL')
  }
  if (filter.tagId) {
    add(
      'EXISTS (SELECT 1 FROM connection_tags ct WHERE ct.connection_id = c.id AND ct.tag_id = ?)',
      filter.tagId
    )
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const { rows } = await db.query(`${SELECT_CONNECTION} ${where} ORDER BY lower(c.name)`, params)
  return rows.map(mapConnection)
}

export async function getConnection(
  db: Db,
  userId: string,
  id: string
): Promise<Connection | null> {
  const { rows } = await db.query(`${SELECT_CONNECTION} WHERE c.id = $2`, [userId, id])
  return rows[0] ? mapConnection(rows[0]) : null
}

export async function createConnection(
  db: Db,
  userId: string,
  input: CreateConnectionInput
): Promise<Connection> {
  if (!(await getGroup(db, input.groupId))) throw notFound('Group')
  await assertAttachable(db, userId, input.credentialRef, null)
  const id = randomUUID()
  const values: Record<string, unknown> = {
    links: [],
    checklist: [],
    relatedFiles: [],
    vpnRequired: false,
    vpnMode: 'inherit',
    ...input
  }
  const keys = Object.keys(CONNECTION_COLUMNS).filter((k) => values[k] !== undefined)
  const columns = ['id', 'group_id', ...keys.map((k) => CONNECTION_COLUMNS[k])]
  const params = [
    id,
    input.groupId,
    ...keys.map((k) => (JSON_COLUMNS.has(k) ? JSON.stringify(values[k]) : values[k]))
  ]
  await db.query(
    `INSERT INTO connections (${columns.join(', ')})
     VALUES (${params.map((_, i) => `$${i + 1}`).join(', ')})`,
    params
  )
  if (input.isFavorite) await setFavorite(db, userId, id, true)
  return (await getConnection(db, userId, id)) as Connection
}

export async function updateConnection(
  db: Db,
  userId: string,
  id: string,
  input: UpdateConnectionInput
): Promise<Connection | null> {
  if (input.groupId && !(await getGroup(db, input.groupId))) throw notFound('Group')
  await assertAttachable(db, userId, input.credentialRef, id)
  const set = setClause(input, { ...CONNECTION_COLUMNS, groupId: 'group_id' }, JSON_COLUMNS)
  const { rows } = await db.query(`UPDATE connections SET ${set.sql} WHERE id = $1 RETURNING id`, [
    id,
    ...set.params
  ])
  if (!rows[0]) return null
  if (input.isFavorite !== undefined) await setFavorite(db, userId, id, input.isFavorite)
  return getConnection(db, userId, id)
}

export async function deleteConnection(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM connections WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

/**
 * One secret belongs to one connection: it can keep its own, or take a loose
 * secret its author just stored. Anything else answers 404, so nobody can
 * point a connection at another connection's password and reveal it.
 */
async function assertAttachable(
  db: Db,
  userId: string,
  credentialRef: string | null | undefined,
  connectionId: string | null
): Promise<void> {
  if (!credentialRef) return
  const { rows } = await db.query<{ created_by: string | null; owner: string | null }>(
    `SELECT s.created_by, (SELECT c.id FROM connections c WHERE c.credential_ref = s.id LIMIT 1) AS owner
     FROM secrets s WHERE s.id = $1`,
    [credentialRef]
  )
  const row = rows[0]
  const ok = row && (row.owner ? row.owner === connectionId : row.created_by === userId)
  if (!ok) throw notFound('Secret')
}

async function setFavorite(db: Db, userId: string, id: string, favorite: boolean): Promise<void> {
  await db.query(
    favorite
      ? 'INSERT INTO user_favorites (user_id, connection_id) VALUES ($1, $2) ON CONFLICT DO NOTHING'
      : 'DELETE FROM user_favorites WHERE user_id = $1 AND connection_id = $2',
    [userId, id]
  )
}

export async function toggleFavorite(
  db: Db,
  userId: string,
  id: string
): Promise<Connection | null> {
  const current = await getConnection(db, userId, id)
  if (!current) return null
  await setFavorite(db, userId, id, !current.isFavorite)
  return getConnection(db, userId, id)
}

/** `copySecret` re-seals the source's secret so each copy owns its own row. */
export async function duplicateConnection(
  db: Db,
  userId: string,
  id: string,
  copySecret: (credentialRef: string) => Promise<string | null>
): Promise<Connection | null> {
  const source = await getConnection(db, userId, id)
  if (!source) return null
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    isFavorite: _f,
    accessCount: _a,
    totalConnectedMs: _t,
    lastConnectedAt: _l,
    ...rest
  } = source
  const credentialRef = rest.credentialRef ? await copySecret(rest.credentialRef) : null
  return createConnection(db, userId, { ...rest, credentialRef, name: `${source.name} (cópia)` })
}

// ── tags ───────────────────────────────────────────────────────────────────

const mapTag = (r: Row): Tag => ({
  id: r.id as string,
  name: r.name as string,
  color: (r.color as string | null) ?? null
})

const UNIQUE_VIOLATION = '23505'

function rethrowDuplicate(error: unknown): never {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new ApiError('conflict', 'A tag with this name already exists')
  }
  throw error
}

export async function listTags(db: Db): Promise<Tag[]> {
  const { rows } = await db.query('SELECT * FROM tags ORDER BY lower(name)')
  return rows.map(mapTag)
}

export async function createTag(db: Db, input: CreateTagInput): Promise<Tag> {
  try {
    const { rows } = await db.query(
      'INSERT INTO tags (id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [randomUUID(), input.name, input.color ?? null]
    )
    return mapTag(rows[0])
  } catch (error) {
    rethrowDuplicate(error)
  }
}

export async function updateTag(db: Db, id: string, input: UpdateTagInput): Promise<Tag | null> {
  const parts: string[] = []
  const params: unknown[] = [id]
  if (input.name !== undefined) {
    params.push(input.name)
    parts.push(`name = $${params.length}`)
  }
  if (input.color !== undefined) {
    params.push(input.color)
    parts.push(`color = $${params.length}`)
  }
  if (parts.length === 0) {
    const { rows } = await db.query('SELECT * FROM tags WHERE id = $1', [id])
    return rows[0] ? mapTag(rows[0]) : null
  }
  try {
    const { rows } = await db.query(
      `UPDATE tags SET ${parts.join(', ')} WHERE id = $1 RETURNING *`,
      params
    )
    return rows[0] ? mapTag(rows[0]) : null
  } catch (error) {
    rethrowDuplicate(error)
  }
}

export async function deleteTag(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM tags WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

export async function listTagsForConnection(db: Db, connectionId: string): Promise<Tag[]> {
  const { rows } = await db.query(
    `SELECT t.* FROM tags t
     INNER JOIN connection_tags ct ON ct.tag_id = t.id
     WHERE ct.connection_id = $1 ORDER BY lower(t.name)`,
    [connectionId]
  )
  return rows.map(mapTag)
}

export async function setTagsForConnection(
  db: Db,
  connectionId: string,
  tagIds: string[]
): Promise<Tag[]> {
  return db.transaction(async (tx) => {
    const exists = await tx.query('SELECT 1 FROM connections WHERE id = $1', [connectionId])
    if (exists.rows.length === 0) throw notFound('Connection')
    await tx.query('DELETE FROM connection_tags WHERE connection_id = $1', [connectionId])
    for (const tagId of new Set(tagIds)) {
      const res = await tx.query(
        `INSERT INTO connection_tags (connection_id, tag_id)
         SELECT $1, id FROM tags WHERE id = $2 RETURNING tag_id`,
        [connectionId, tagId]
      )
      if (res.rows.length === 0) throw notFound('Tag')
    }
    return listTagsForConnection(tx, connectionId)
  })
}
