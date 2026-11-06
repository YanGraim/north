import { randomUUID } from 'node:crypto'
import type {
  Access,
  CreateAccessInput,
  ListAccessesFilter,
  Tag,
  UpdateAccessInput
} from '@shared/types'
import type { Db } from '../db'
import { ApiError, notFound } from '../errors'
import { assertAttachable, getGroup, iso, knownVpn, mapTag, setClause } from './inventory'

type Row = Record<string, unknown>

/**
 * Accesses an organization keeps (REC-023): database, login (web portal) and
 * other. API collections stay personal for now, because their settings can
 * carry tokens in clear text and the server only stores secrets sealed.
 */
export const ORGANIZATION_ACCESS_TYPES = ['database', 'login', 'other'] as const

const ACCESS_COLUMNS: Record<string, string> = {
  type: 'type',
  name: 'name',
  description: 'description',
  notes: 'notes',
  username: 'username',
  credentialRef: 'credential_ref',
  url: 'url',
  links: 'links',
  icon: 'icon',
  color: 'color',
  engine: 'engine',
  host: 'host',
  port: 'port',
  database: 'database',
  ssl: 'ssl',
  vpnMode: 'vpn_mode',
  vpnProfileId: 'vpn_id'
}
const JSON_COLUMNS = new Set(['links'])

const mapAccess = (r: Row): Access => ({
  id: r.id as string,
  groupId: r.group_id as string,
  type: r.type as Access['type'],
  name: r.name as string,
  description: (r.description as string | null) ?? null,
  notes: (r.notes as string | null) ?? null,
  username: (r.username as string | null) ?? null,
  credentialRef: (r.credential_ref as string | null) ?? null,
  url: (r.url as string | null) ?? null,
  links: (r.links as Access['links']) ?? [],
  icon: (r.icon as string | null) ?? null,
  color: (r.color as string | null) ?? null,
  isFavorite: Boolean(r.is_favorite),
  engine: (r.engine as Access['engine']) ?? null,
  host: (r.host as string | null) ?? null,
  port: r.port === null || r.port === undefined ? null : Number(r.port),
  database: (r.database as string | null) ?? null,
  ssl: r.ssl === null || r.ssl === undefined ? null : Boolean(r.ssl),
  apiConfig: null,
  apiEnvironmentEnabled: false,
  vpnMode: r.vpn_mode as Access['vpnMode'],
  vpnProfileId: (r.vpn_id as string | null) ?? null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at)
})

function assertType(type: string | undefined): void {
  if (type !== undefined && !(ORGANIZATION_ACCESS_TYPES as readonly string[]).includes(type)) {
    throw new ApiError(
      'validation',
      'API collections are not available in organizations yet. Keep them in the personal workspace.'
    )
  }
}

const SELECT_ACCESS = `
  SELECT a.*, (f.user_id IS NOT NULL) AS is_favorite
  FROM accesses a
  INNER JOIN groups g ON g.id = a.group_id
  INNER JOIN environments e ON e.id = g.environment_id
  LEFT JOIN user_access_favorites f ON f.access_id = a.id AND f.user_id = $1
`

export async function listAccesses(
  db: Db,
  userId: string,
  filter: ListAccessesFilter = {}
): Promise<Access[]> {
  const clauses: string[] = []
  const params: unknown[] = [userId]
  const add = (sql: string, value: unknown): void => {
    params.push(value)
    clauses.push(sql.replace('?', `$${params.length}`))
  }
  if (filter.groupId) add('a.group_id = ?', filter.groupId)
  if (filter.environmentId) add('g.environment_id = ?', filter.environmentId)
  if (filter.clientId) add('e.client_id = ?', filter.clientId)
  if (filter.type) add('a.type = ?', filter.type)
  if (filter.isFavorite !== undefined) {
    clauses.push(filter.isFavorite ? 'f.user_id IS NOT NULL' : 'f.user_id IS NULL')
  }
  if (filter.tagId) {
    add(
      'EXISTS (SELECT 1 FROM access_tags at WHERE at.access_id = a.id AND at.tag_id = ?)',
      filter.tagId
    )
  }
  // API environments are an API-collection notion; none live here.
  if (filter.apiEnvironmentEnabled) clauses.push('false')
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const { rows } = await db.query(`${SELECT_ACCESS} ${where} ORDER BY lower(a.name)`, params)
  return rows.map(mapAccess)
}

export async function getAccess(db: Db, userId: string, id: string): Promise<Access | null> {
  const { rows } = await db.query(`${SELECT_ACCESS} WHERE a.id = $2`, [userId, id])
  return rows[0] ? mapAccess(rows[0]) : null
}

async function setFavorite(db: Db, userId: string, id: string, favorite: boolean): Promise<void> {
  await db.query(
    favorite
      ? 'INSERT INTO user_access_favorites (user_id, access_id) VALUES ($1, $2) ON CONFLICT DO NOTHING'
      : 'DELETE FROM user_access_favorites WHERE user_id = $1 AND access_id = $2',
    [userId, id]
  )
}

export async function createAccess(
  db: Db,
  userId: string,
  input: CreateAccessInput
): Promise<Access> {
  assertType(input.type)
  if (!(await getGroup(db, input.groupId))) throw notFound('Group')
  await assertAttachable(db, userId, input.credentialRef, null)
  const id = randomUUID()
  const values: Record<string, unknown> = {
    links: [],
    vpnMode: 'inherit',
    ...input,
    vpnProfileId: await knownVpn(db, input.vpnProfileId)
  }
  const keys = Object.keys(ACCESS_COLUMNS).filter((k) => values[k] !== undefined)
  const columns = ['id', 'group_id', ...keys.map((k) => ACCESS_COLUMNS[k])]
  const params = [
    id,
    input.groupId,
    ...keys.map((k) => (JSON_COLUMNS.has(k) ? JSON.stringify(values[k]) : values[k]))
  ]
  await db.query(
    `INSERT INTO accesses (${columns.join(', ')})
     VALUES (${params.map((_, i) => `$${i + 1}`).join(', ')})`,
    params
  )
  if (input.isFavorite) await setFavorite(db, userId, id, true)
  return (await getAccess(db, userId, id)) as Access
}

export async function updateAccess(
  db: Db,
  userId: string,
  id: string,
  input: UpdateAccessInput
): Promise<Access | null> {
  assertType(input.type)
  if (input.groupId && !(await getGroup(db, input.groupId))) throw notFound('Group')
  await assertAttachable(db, userId, input.credentialRef, id)
  const patch = { ...input, vpnProfileId: await knownVpn(db, input.vpnProfileId) }
  const set = setClause(patch, { ...ACCESS_COLUMNS, groupId: 'group_id' }, JSON_COLUMNS)
  const { rows } = await db.query(`UPDATE accesses SET ${set.sql} WHERE id = $1 RETURNING id`, [
    id,
    ...set.params
  ])
  if (!rows[0]) return null
  if (input.isFavorite !== undefined) await setFavorite(db, userId, id, input.isFavorite)
  return getAccess(db, userId, id)
}

export async function deleteAccess(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM accesses WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

export async function toggleAccessFavorite(
  db: Db,
  userId: string,
  id: string
): Promise<Access | null> {
  const current = await getAccess(db, userId, id)
  if (!current) return null
  await setFavorite(db, userId, id, !current.isFavorite)
  return getAccess(db, userId, id)
}

export async function listTagsForAccess(db: Db, accessId: string): Promise<Tag[]> {
  const { rows } = await db.query(
    `SELECT t.* FROM tags t
     INNER JOIN access_tags at ON at.tag_id = t.id
     WHERE at.access_id = $1 ORDER BY lower(t.name)`,
    [accessId]
  )
  return rows.map(mapTag)
}

export async function setTagsForAccess(db: Db, accessId: string, tagIds: string[]): Promise<Tag[]> {
  return db.transaction(async (tx) => {
    const exists = await tx.query('SELECT 1 FROM accesses WHERE id = $1', [accessId])
    if (exists.rows.length === 0) throw notFound('Access')
    await tx.query('DELETE FROM access_tags WHERE access_id = $1', [accessId])
    for (const tagId of new Set(tagIds)) {
      const res = await tx.query(
        `INSERT INTO access_tags (access_id, tag_id)
         SELECT $1, id FROM tags WHERE id = $2 RETURNING tag_id`,
        [accessId, tagId]
      )
      if (res.rows.length === 0) throw notFound('Tag')
    }
    return listTagsForAccess(tx, accessId)
  })
}
