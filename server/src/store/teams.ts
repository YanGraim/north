import { randomUUID } from 'node:crypto'
import type { Db } from '../db'
import { ApiError } from '../errors'

export type Team = {
  id: string
  name: string
  description: string
  /** Entra group object id; members then follow that group at each sign-in. */
  entraGroupId: string | null
  createdAt: string
  members: Array<{ userId: string; source: 'manual' | 'entra' }>
}

type TeamRow = {
  id: string
  name: string
  description: string
  entra_group_id: string | null
  created_at: Date | string
}

const conflict = (error: unknown): never => {
  if ((error as { code?: string }).code === '23505') {
    throw new ApiError('conflict', 'A team with this name or Entra group already exists')
  }
  throw error
}

export async function listTeams(db: Db): Promise<Team[]> {
  const [teams, members] = await Promise.all([
    db.query<TeamRow>(
      'SELECT id, name, description, entra_group_id, created_at FROM teams ORDER BY lower(name)'
    ),
    db.query<{ team_id: string; user_id: string; source: 'manual' | 'entra' }>(
      'SELECT team_id, user_id, source FROM team_members ORDER BY created_at'
    )
  ])
  return teams.rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    entraGroupId: t.entra_group_id,
    createdAt: new Date(String(t.created_at)).toISOString(),
    members: members.rows
      .filter((m) => m.team_id === t.id)
      .map((m) => ({ userId: m.user_id, source: m.source }))
  }))
}

export async function getTeam(db: Db, id: string): Promise<Team | null> {
  return (await listTeams(db)).find((t) => t.id === id) ?? null
}

export async function createTeam(
  db: Db,
  input: { name: string; description?: string; entraGroupId?: string | null }
): Promise<Team> {
  const id = randomUUID()
  try {
    await db.query(
      'INSERT INTO teams (id, name, description, entra_group_id) VALUES ($1, $2, $3, $4)',
      [id, input.name.trim(), input.description?.trim() ?? '', input.entraGroupId?.trim() || null]
    )
  } catch (error) {
    conflict(error)
  }
  return (await getTeam(db, id)) as Team
}

export async function updateTeam(
  db: Db,
  id: string,
  input: { name?: string; description?: string; entraGroupId?: string | null }
): Promise<Team | null> {
  const current = await getTeam(db, id)
  if (!current) return null
  const entra =
    input.entraGroupId === undefined ? current.entraGroupId : input.entraGroupId?.trim() || null
  try {
    await db.query(
      'UPDATE teams SET name = $2, description = $3, entra_group_id = $4 WHERE id = $1',
      [
        id,
        input.name?.trim() || current.name,
        input.description?.trim() ?? current.description,
        entra
      ]
    )
  } catch (error) {
    conflict(error)
  }
  // Unlinking the Entra group keeps the people, now as manual members.
  if (current.entraGroupId && !entra) {
    await db.query("UPDATE team_members SET source = 'manual' WHERE team_id = $1", [id])
  }
  return getTeam(db, id)
}

export async function deleteTeam(db: Db, id: string): Promise<string[] | null> {
  const team = await getTeam(db, id)
  if (!team) return null
  await db.query('DELETE FROM teams WHERE id = $1', [id])
  return team.members.map((m) => m.userId)
}

export async function addTeamMember(db: Db, teamId: string, userId: string): Promise<void> {
  const team = await db.query('SELECT 1 FROM teams WHERE id = $1', [teamId])
  if (!team.rows[0]) throw new ApiError('not_found', 'Team not found')
  const user = await db.query('SELECT 1 FROM users WHERE id = $1', [userId])
  if (!user.rows[0]) throw new ApiError('not_found', 'User not found')
  await db.query(
    `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)
     ON CONFLICT (team_id, user_id) DO UPDATE SET source = 'manual'`,
    [teamId, userId]
  )
}

export async function removeTeamMember(db: Db, teamId: string, userId: string): Promise<boolean> {
  const { rows } = await db.query(
    'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING user_id',
    [teamId, userId]
  )
  return rows.length > 0
}

/**
 * Sign-in with Entra groups in the token: joins the teams linked to those
 * groups and leaves the linked teams the person is no longer in. Members an
 * admin added by hand stay. Returns whether anything changed.
 */
export async function syncEntraTeams(db: Db, userId: string, groups: string[]): Promise<boolean> {
  const { rows: linked } = await db.query<{ id: string; entra_group_id: string }>(
    'SELECT id, entra_group_id FROM teams WHERE entra_group_id IS NOT NULL'
  )
  if (linked.length === 0) return false
  const wanted = new Set(linked.filter((t) => groups.includes(t.entra_group_id)).map((t) => t.id))
  let changed = false
  for (const team of linked) {
    if (wanted.has(team.id)) {
      const { rows } = await db.query(
        `INSERT INTO team_members (team_id, user_id, source) VALUES ($1, $2, 'entra')
         ON CONFLICT (team_id, user_id) DO NOTHING RETURNING user_id`,
        [team.id, userId]
      )
      changed ||= rows.length > 0
    } else {
      const { rows } = await db.query(
        `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 AND source = 'entra'
         RETURNING user_id`,
        [team.id, userId]
      )
      changed ||= rows.length > 0
    }
  }
  return changed
}
