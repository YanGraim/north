import type { Grant, ProjectRole, ScopeType } from '../access'
import type { Db } from '../db'
import { notFound } from '../errors'

const TABLE: Record<ScopeType, string> = {
  client: 'clients',
  environment: 'environments',
  group: 'groups'
}
const COLUMN: Record<ScopeType, string> = {
  client: 'client_id',
  environment: 'environment_id',
  group: 'group_id'
}

export type UserGrant = Grant & { userId: string; email: string; name: string }

/** Creates or changes the role of one user on one project. */
export async function setGrant(
  db: Db,
  userId: string,
  scopeType: ScopeType,
  scopeId: string,
  role: ProjectRole
): Promise<void> {
  const user = await db.query('SELECT 1 FROM users WHERE id = $1', [userId])
  if (!user.rows[0]) throw notFound('User')
  const scope = await db.query(`SELECT 1 FROM ${TABLE[scopeType]} WHERE id = $1`, [scopeId])
  if (!scope.rows[0]) throw notFound('Project')
  await db.query(
    `INSERT INTO project_grants (user_id, scope_type, ${COLUMN[scopeType]}, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, scope_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, scopeType, scopeId, role]
  )
}

export async function deleteGrant(db: Db, userId: string, scopeId: string): Promise<boolean> {
  const { rows } = await db.query(
    'DELETE FROM project_grants WHERE user_id = $1 AND scope_id = $2 RETURNING user_id',
    [userId, scopeId]
  )
  return rows.length > 0
}

/** The node itself and every parent up to its client. */
async function scopeChain(db: Db, scopeType: ScopeType, scopeId: string): Promise<string[]> {
  const sql: Record<ScopeType, string> = {
    client: 'SELECT id AS a, NULL::uuid AS b, NULL::uuid AS c FROM clients WHERE id = $1',
    environment: 'SELECT id AS a, client_id AS b, NULL::uuid AS c FROM environments WHERE id = $1',
    group: `SELECT g.id AS a, g.environment_id AS b, e.client_id AS c
            FROM groups g INNER JOIN environments e ON e.id = g.environment_id WHERE g.id = $1`
  }
  const { rows } = await db.query<{ a: string; b: string | null; c: string | null }>(
    sql[scopeType],
    [scopeId]
  )
  if (!rows[0]) throw notFound('Project')
  return [rows[0].a, rows[0].b, rows[0].c].filter((id): id is string => Boolean(id))
}

/** Every grant, or only those that reach one project (on it or above it). */
export async function listUserGrants(
  db: Db,
  scope?: { scopeType: ScopeType; scopeId: string }
): Promise<UserGrant[]> {
  const chain = scope ? await scopeChain(db, scope.scopeType, scope.scopeId) : null
  const { rows } = await db.query<{
    user_id: string
    email: string
    name: string
    scope_type: ScopeType
    scope_id: string
    role: ProjectRole
  }>(
    `SELECT pg.user_id, u.email, u.name, pg.scope_type, pg.scope_id, pg.role
     FROM project_grants pg INNER JOIN users u ON u.id = pg.user_id
     ${chain ? 'WHERE pg.scope_id = ANY($1::uuid[])' : ''}
     ORDER BY u.email, pg.created_at`,
    chain ? [chain] : []
  )
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    scopeType: r.scope_type,
    scopeId: r.scope_id,
    role: r.role
  }))
}
