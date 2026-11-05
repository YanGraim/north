import { randomUUID } from 'node:crypto'
import type { Grant, ProjectRole, ScopeType } from '../access'
import type { Db } from '../db'
import { notFound } from '../errors'

const TABLE: Record<ScopeType, string> = {
  client: 'clients',
  environment: 'environments',
  group: 'groups',
  connection: 'connections'
}
const COLUMN: Record<ScopeType, string> = {
  client: 'client_id',
  environment: 'environment_id',
  group: 'group_id',
  connection: 'connection_id'
}

/** Who receives a grant: one person, or every member of a team. */
export type Principal = { kind: 'user' | 'team'; id: string }

export type PrincipalGrant = Grant & {
  principal: 'user' | 'team'
  userId: string | null
  teamId: string | null
  email: string | null
  /** E-mail for a person, team name for a team. */
  label: string
  name: string
}

const PRINCIPAL_COLUMN = { user: 'user_id', team: 'team_id' } as const

/** Creates or changes the role of one person or team on one project. */
export async function setGrant(
  db: Db,
  principal: Principal,
  scopeType: ScopeType,
  scopeId: string,
  role: ProjectRole
): Promise<void> {
  const owner = await db.query(`SELECT 1 FROM ${principal.kind}s WHERE id = $1`, [principal.id])
  if (!owner.rows[0]) throw notFound(principal.kind === 'user' ? 'User' : 'Team')
  const scope = await db.query(`SELECT 1 FROM ${TABLE[scopeType]} WHERE id = $1`, [scopeId])
  if (!scope.rows[0]) throw notFound('Project')
  const column = PRINCIPAL_COLUMN[principal.kind]
  await db.query(
    `INSERT INTO project_grants (id, ${column}, scope_type, ${COLUMN[scopeType]}, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (${column}, scope_id) WHERE ${column} IS NOT NULL
     DO UPDATE SET role = EXCLUDED.role`,
    [randomUUID(), principal.id, scopeType, scopeId, role]
  )
}

export async function deleteGrant(db: Db, principal: Principal, scopeId: string): Promise<boolean> {
  const { rows } = await db.query(
    `DELETE FROM project_grants WHERE ${PRINCIPAL_COLUMN[principal.kind]} = $1 AND scope_id = $2
     RETURNING id`,
    [principal.id, scopeId]
  )
  return rows.length > 0
}

/** The node itself and every parent up to its client. */
async function scopeChain(db: Db, scopeType: ScopeType, scopeId: string): Promise<string[]> {
  const sql: Record<ScopeType, string> = {
    client:
      'SELECT id AS a, NULL::uuid AS b, NULL::uuid AS c, NULL::uuid AS d FROM clients WHERE id = $1',
    environment:
      'SELECT id AS a, client_id AS b, NULL::uuid AS c, NULL::uuid AS d FROM environments WHERE id = $1',
    group: `SELECT g.id AS a, g.environment_id AS b, e.client_id AS c, NULL::uuid AS d
            FROM groups g INNER JOIN environments e ON e.id = g.environment_id WHERE g.id = $1`,
    connection: `SELECT c.id AS a, c.group_id AS b, g.environment_id AS c, e.client_id AS d
            FROM connections c INNER JOIN groups g ON g.id = c.group_id
            INNER JOIN environments e ON e.id = g.environment_id WHERE c.id = $1`
  }
  const { rows } = await db.query<{
    a: string
    b: string | null
    c: string | null
    d: string | null
  }>(sql[scopeType], [scopeId])
  if (!rows[0]) throw notFound('Project')
  return [rows[0].a, rows[0].b, rows[0].c, rows[0].d].filter((id): id is string => Boolean(id))
}

/** Every grant, or only those that reach one project (on it or above it). */
export async function listPrincipalGrants(
  db: Db,
  scope?: { scopeType: ScopeType; scopeId: string }
): Promise<PrincipalGrant[]> {
  const chain = scope ? await scopeChain(db, scope.scopeType, scope.scopeId) : null
  const { rows } = await db.query<{
    user_id: string | null
    team_id: string | null
    email: string | null
    user_name: string | null
    team_name: string | null
    scope_type: ScopeType
    scope_id: string
    role: ProjectRole
  }>(
    `SELECT pg.user_id, pg.team_id, u.email, u.name AS user_name, t.name AS team_name,
            pg.scope_type, pg.scope_id, pg.role
     FROM project_grants pg
     LEFT JOIN users u ON u.id = pg.user_id
     LEFT JOIN teams t ON t.id = pg.team_id
     ${chain ? 'WHERE pg.scope_id = ANY($1::uuid[])' : ''}
     ORDER BY pg.team_id IS NULL, COALESCE(t.name, u.email), pg.created_at`,
    chain ? [chain] : []
  )
  return rows.map((r) => ({
    principal: r.team_id ? 'team' : 'user',
    userId: r.user_id,
    teamId: r.team_id,
    email: r.email,
    label: r.team_id ? (r.team_name ?? '') : (r.email ?? ''),
    name: r.team_id ? (r.team_name ?? '') : (r.user_name ?? ''),
    scopeType: r.scope_type,
    scopeId: r.scope_id,
    role: r.role
  }))
}
