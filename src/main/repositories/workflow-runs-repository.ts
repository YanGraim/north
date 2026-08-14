import type {
  RunMode,
  RunStatus,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunTarget
} from '@shared/types'
import { WorkflowDefinitionSchema } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type WorkflowRunRow = {
  id: string
  workflow_id: string
  group_id: string
  mode: string
  status: string
  targets: string
  definition_snapshot: string
  variables_snapshot: string
  input_values: string
  started_at: string
  finished_at: string | null
}

export type CreateWorkflowRunRecord = {
  workflowId: string
  groupId: string
  mode: RunMode
  status?: RunStatus
  targets: WorkflowRunTarget[]
  definitionSnapshot: WorkflowDefinition
  variablesSnapshot: Record<string, string>
  inputValues: Record<string, string | boolean>
}

function mapRun(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    groupId: row.group_id,
    mode: row.mode as RunMode,
    status: row.status as RunStatus,
    targets: JSON.parse(row.targets) as WorkflowRunTarget[],
    definitionSnapshot: WorkflowDefinitionSchema.parse(JSON.parse(row.definition_snapshot)),
    variablesSnapshot: JSON.parse(row.variables_snapshot) as Record<string, string>,
    inputValues: JSON.parse(row.input_values) as Record<string, string | boolean>,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }
}

export class WorkflowRunsRepository {
  private readonly getStmt
  private readonly listByWorkflowStmt
  private readonly listByGroupStmt
  private readonly insertStmt
  private readonly updateStatusStmt

  constructor(db: SqliteDatabase) {
    this.getStmt = db.prepare(`
      SELECT id, workflow_id, group_id, mode, status, targets,
             definition_snapshot, variables_snapshot, input_values,
             started_at, finished_at
      FROM workflow_runs
      WHERE id = ?
    `)
    this.listByWorkflowStmt = db.prepare(`
      SELECT id, workflow_id, group_id, mode, status, targets,
             definition_snapshot, variables_snapshot, input_values,
             started_at, finished_at
      FROM workflow_runs
      WHERE workflow_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `)
    this.listByGroupStmt = db.prepare(`
      SELECT id, workflow_id, group_id, mode, status, targets,
             definition_snapshot, variables_snapshot, input_values,
             started_at, finished_at
      FROM workflow_runs
      WHERE group_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO workflow_runs (
        id, workflow_id, group_id, mode, status, targets,
        definition_snapshot, variables_snapshot, input_values,
        started_at, finished_at
      ) VALUES (
        @id, @workflow_id, @group_id, @mode, @status, @targets,
        @definition_snapshot, @variables_snapshot, @input_values,
        @started_at, @finished_at
      )
    `)
    this.updateStatusStmt = db.prepare(`
      UPDATE workflow_runs
      SET status = @status, finished_at = @finished_at
      WHERE id = @id
    `)
  }

  get(id: string): WorkflowRun | null {
    const row = this.getStmt.get(id) as WorkflowRunRow | undefined
    return row ? mapRun(row) : null
  }

  listByWorkflow(workflowId: string, limit = 20): WorkflowRun[] {
    return (this.listByWorkflowStmt.all(workflowId, limit) as WorkflowRunRow[]).map(mapRun)
  }

  listByGroup(groupId: string, limit = 20): WorkflowRun[] {
    return (this.listByGroupStmt.all(groupId, limit) as WorkflowRunRow[]).map(mapRun)
  }

  create(input: CreateWorkflowRunRecord): WorkflowRun {
    const now = nowIso()
    const run: WorkflowRun = {
      id: newId(),
      workflowId: input.workflowId,
      groupId: input.groupId,
      mode: input.mode,
      status: input.status ?? 'pending',
      targets: input.targets,
      definitionSnapshot: input.definitionSnapshot,
      variablesSnapshot: input.variablesSnapshot,
      inputValues: input.inputValues,
      startedAt: now,
      finishedAt: null
    }
    this.insertStmt.run({
      id: run.id,
      workflow_id: run.workflowId,
      group_id: run.groupId,
      mode: run.mode,
      status: run.status,
      targets: JSON.stringify(run.targets),
      definition_snapshot: JSON.stringify(run.definitionSnapshot),
      variables_snapshot: JSON.stringify(run.variablesSnapshot),
      input_values: JSON.stringify(run.inputValues),
      started_at: run.startedAt,
      finished_at: run.finishedAt
    })
    return run
  }

  updateStatus(
    id: string,
    status: RunStatus,
    finishedAt: string | null = null
  ): WorkflowRun | null {
    const existing = this.get(id)
    if (!existing) return null
    this.updateStatusStmt.run({
      id,
      status,
      finished_at: finishedAt
    })
    return this.get(id)
  }
}
