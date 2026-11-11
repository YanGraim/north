import { randomUUID } from 'node:crypto'
import type {
  CreateEnvironmentUpdateInput,
  CreateGroupVariableInput,
  CreateWorkflowInput,
  EnvironmentUpdate,
  GroupVariable,
  UpdateGroupVariableInput,
  UpdateWorkflowInput,
  Workflow
} from '@shared/types'
import { emptyWorkflowDefinition } from '@shared/types'
import type { Db } from '../db'
import { ApiError } from '../errors'
import { iso, setClause } from './inventory'

type Row = Record<string, unknown>

/**
 * Workflows and group variables of an organization (REC-024). Each person runs
 * a workflow on their own computer; the server only keeps the definition and,
 * for git-tracked runs, the environment update with who ran it.
 */

const mapWorkflow = (r: Row): Workflow => ({
  id: r.id as string,
  groupId: r.group_id as string,
  name: r.name as string,
  description: (r.description as string | null) ?? null,
  icon: (r.icon as string | null) ?? null,
  preferredConnectionId: (r.preferred_connection_id as string | null) ?? null,
  sortOrder: Number(r.sort_order),
  definition: r.definition as Workflow['definition'],
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at)
})

const WORKFLOW_COLUMNS: Record<string, string> = {
  groupId: 'group_id',
  name: 'name',
  description: 'description',
  icon: 'icon',
  preferredConnectionId: 'preferred_connection_id',
  sortOrder: 'sort_order',
  definition: 'definition'
}
const WORKFLOW_JSON = new Set(['definition'])

/** A preferred connection must sit in the workflow's own group (or be cleared). */
async function knownConnection(
  db: Db,
  groupId: string,
  connectionId: string | null | undefined
): Promise<string | null | undefined> {
  if (connectionId === undefined || connectionId === null) return connectionId
  const { rows } = await db.query('SELECT 1 FROM connections WHERE id = $1 AND group_id = $2', [
    connectionId,
    groupId
  ])
  return rows[0] ? connectionId : null
}

export async function listWorkflows(db: Db, groupId?: string): Promise<Workflow[]> {
  const { rows } = groupId
    ? await db.query(
        'SELECT * FROM workflows WHERE group_id = $1 ORDER BY sort_order, lower(name)',
        [groupId]
      )
    : await db.query('SELECT * FROM workflows ORDER BY sort_order, lower(name)')
  return rows.map(mapWorkflow)
}

export async function getWorkflow(db: Db, id: string): Promise<Workflow | null> {
  const { rows } = await db.query('SELECT * FROM workflows WHERE id = $1', [id])
  return rows[0] ? mapWorkflow(rows[0]) : null
}

export async function createWorkflow(db: Db, input: CreateWorkflowInput): Promise<Workflow> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO workflows
       (id, group_id, name, description, icon, preferred_connection_id, sort_order, definition)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      input.groupId,
      input.name.trim(),
      input.description ?? null,
      input.icon ?? null,
      (await knownConnection(db, input.groupId, input.preferredConnectionId)) ?? null,
      input.sortOrder ?? 0,
      JSON.stringify(input.definition ?? emptyWorkflowDefinition())
    ]
  )
  return (await getWorkflow(db, id)) as Workflow
}

export async function updateWorkflow(
  db: Db,
  id: string,
  input: UpdateWorkflowInput
): Promise<Workflow | null> {
  const current = await getWorkflow(db, id)
  if (!current) return null
  const groupId = input.groupId ?? current.groupId
  const patch = {
    ...input,
    name: input.name?.trim(),
    preferredConnectionId: await knownConnection(db, groupId, input.preferredConnectionId)
  }
  const set = setClause(patch, WORKFLOW_COLUMNS, WORKFLOW_JSON)
  await db.query(`UPDATE workflows SET ${set.sql} WHERE id = $1`, [id, ...set.params])
  return getWorkflow(db, id)
}

export async function deleteWorkflow(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM workflows WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

const mapVariable = (r: Row): GroupVariable => ({
  id: r.id as string,
  groupId: r.group_id as string,
  key: r.key as string,
  value: r.value as string,
  description: (r.description as string | null) ?? null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at)
})

const duplicateKey = (key: string) =>
  new ApiError('conflict', `A variable named "${key}" already exists in this group`)

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'

export async function listVariables(db: Db, groupId: string): Promise<GroupVariable[]> {
  const { rows } = await db.query(
    'SELECT * FROM group_variables WHERE group_id = $1 ORDER BY lower(key)',
    [groupId]
  )
  return rows.map(mapVariable)
}

export async function getVariable(db: Db, id: string): Promise<GroupVariable | null> {
  const { rows } = await db.query('SELECT * FROM group_variables WHERE id = $1', [id])
  return rows[0] ? mapVariable(rows[0]) : null
}

export async function createVariable(
  db: Db,
  input: CreateGroupVariableInput
): Promise<GroupVariable> {
  const id = randomUUID()
  try {
    await db.query(
      `INSERT INTO group_variables (id, group_id, key, value, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.groupId, input.key.trim(), input.value, input.description ?? null]
    )
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateKey(input.key.trim())
    throw error
  }
  return (await getVariable(db, id)) as GroupVariable
}

export async function updateVariable(
  db: Db,
  id: string,
  input: UpdateGroupVariableInput
): Promise<GroupVariable | null> {
  const set = setClause(
    { ...input, key: input.key?.trim() },
    { key: 'key', value: 'value', description: 'description' }
  )
  try {
    const { rows } = await db.query(
      `UPDATE group_variables SET ${set.sql} WHERE id = $1 RETURNING id`,
      [id, ...set.params]
    )
    if (!rows[0]) return null
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateKey(input.key?.trim() ?? '')
    throw error
  }
  return getVariable(db, id)
}

export async function deleteVariable(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM group_variables WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

const SELECT_UPDATE = `
  SELECT u.*, us.name AS user_name, us.email AS user_email
  FROM environment_updates u
  LEFT JOIN users us ON us.id = u.user_id
`

const mapUpdate = (r: Row): EnvironmentUpdate => ({
  id: r.id as string,
  environmentId: r.environment_id as string,
  connectionId: r.connection_id as string,
  workflowId: r.workflow_id as string,
  workflowRunId: r.workflow_run_id as string,
  branch: r.branch as string,
  previousCommit: r.previous_commit as string,
  currentCommit: r.current_commit as string,
  startedAt: iso(r.started_at),
  finishedAt: iso(r.finished_at),
  status: r.status as EnvironmentUpdate['status'],
  commits: r.commits as EnvironmentUpdate['commits'],
  filesChanged: Number(r.files_changed),
  tag: (r.tag as string | null) ?? null,
  ranBy: r.user_id
    ? {
        id: r.user_id as string,
        name: (r.user_name as string | null) ?? null,
        email: (r.user_email as string | null) ?? ''
      }
    : null
})

/** Newest first; one environment, or every environment when none is given. */
export async function listUpdates(
  db: Db,
  filter: { environmentId?: string; limit: number }
): Promise<EnvironmentUpdate[]> {
  const { rows } = filter.environmentId
    ? await db.query(
        `${SELECT_UPDATE} WHERE u.environment_id = $1 ORDER BY u.started_at DESC LIMIT $2`,
        [filter.environmentId, filter.limit]
      )
    : await db.query(`${SELECT_UPDATE} ORDER BY u.started_at DESC LIMIT $1`, [filter.limit])
  return rows.map(mapUpdate)
}

export async function createUpdate(
  db: Db,
  userId: string,
  input: CreateEnvironmentUpdateInput
): Promise<EnvironmentUpdate> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO environment_updates
       (id, environment_id, connection_id, workflow_id, workflow_run_id, user_id, branch,
        previous_commit, current_commit, started_at, finished_at, status, commits, files_changed, tag)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      input.environmentId,
      input.connectionId,
      input.workflowId,
      input.workflowRunId,
      userId,
      input.branch,
      input.previousCommit,
      input.currentCommit,
      input.startedAt,
      input.finishedAt,
      input.status,
      JSON.stringify(input.commits),
      input.filesChanged,
      input.tag ?? null
    ]
  )
  const { rows } = await db.query(`${SELECT_UPDATE} WHERE u.id = $1`, [id])
  return mapUpdate(rows[0])
}
