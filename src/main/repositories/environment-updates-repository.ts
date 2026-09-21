import type {
  CreateEnvironmentUpdateInput,
  EnvironmentUpdate,
  EnvironmentUpdateCommit,
  EnvironmentUpdateStatus
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type EnvironmentUpdateRow = {
  id: string
  environment_id: string
  connection_id: string
  workflow_id: string
  workflow_run_id: string
  branch: string
  previous_commit: string
  current_commit: string
  started_at: string
  finished_at: string
  status: string
  commits: string
  files_changed: number
}

function mapRow(row: EnvironmentUpdateRow): EnvironmentUpdate {
  return {
    id: row.id,
    environmentId: row.environment_id,
    connectionId: row.connection_id,
    workflowId: row.workflow_id,
    workflowRunId: row.workflow_run_id,
    branch: row.branch,
    previousCommit: row.previous_commit,
    currentCommit: row.current_commit,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status as EnvironmentUpdateStatus,
    commits: JSON.parse(row.commits) as EnvironmentUpdateCommit[],
    filesChanged: row.files_changed
  }
}

export class EnvironmentUpdatesRepository {
  private readonly getStmt
  private readonly listByEnvironmentStmt
  private readonly listRecentStmt
  private readonly insertStmt

  constructor(db: SqliteDatabase) {
    this.getStmt = db.prepare(`
      SELECT id, environment_id, connection_id, workflow_id, workflow_run_id,
             branch, previous_commit, current_commit, started_at, finished_at,
             status, commits, files_changed
      FROM environment_updates
      WHERE id = ?
    `)
    this.listByEnvironmentStmt = db.prepare(`
      SELECT id, environment_id, connection_id, workflow_id, workflow_run_id,
             branch, previous_commit, current_commit, started_at, finished_at,
             status, commits, files_changed
      FROM environment_updates
      WHERE environment_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `)
    this.listRecentStmt = db.prepare(`
      SELECT id, environment_id, connection_id, workflow_id, workflow_run_id,
             branch, previous_commit, current_commit, started_at, finished_at,
             status, commits, files_changed
      FROM environment_updates
      ORDER BY started_at DESC
      LIMIT ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO environment_updates (
        id, environment_id, connection_id, workflow_id, workflow_run_id,
        branch, previous_commit, current_commit, started_at, finished_at,
        status, commits, files_changed, created_at
      ) VALUES (
        @id, @environment_id, @connection_id, @workflow_id, @workflow_run_id,
        @branch, @previous_commit, @current_commit, @started_at, @finished_at,
        @status, @commits, @files_changed, @created_at
      )
    `)
  }

  get(id: string): EnvironmentUpdate | null {
    const row = this.getStmt.get(id) as EnvironmentUpdateRow | undefined
    return row ? mapRow(row) : null
  }

  listByEnvironment(environmentId: string, limit = 200): EnvironmentUpdate[] {
    return (this.listByEnvironmentStmt.all(environmentId, limit) as EnvironmentUpdateRow[]).map(
      mapRow
    )
  }

  /** Global feed across every environment — powers the Dashboard "recent updates" widget. */
  listRecent(limit = 100): EnvironmentUpdate[] {
    return (this.listRecentStmt.all(limit) as EnvironmentUpdateRow[]).map(mapRow)
  }

  create(input: CreateEnvironmentUpdateInput): EnvironmentUpdate {
    const update: EnvironmentUpdate = {
      id: newId(),
      environmentId: input.environmentId,
      connectionId: input.connectionId,
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
      branch: input.branch,
      previousCommit: input.previousCommit,
      currentCommit: input.currentCommit,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      status: input.status,
      commits: input.commits,
      filesChanged: input.filesChanged
    }
    this.insertStmt.run({
      id: update.id,
      environment_id: update.environmentId,
      connection_id: update.connectionId,
      workflow_id: update.workflowId,
      workflow_run_id: update.workflowRunId,
      branch: update.branch,
      previous_commit: update.previousCommit,
      current_commit: update.currentCommit,
      started_at: update.startedAt,
      finished_at: update.finishedAt,
      status: update.status,
      commits: JSON.stringify(update.commits),
      files_changed: update.filesChanged,
      created_at: nowIso()
    })
    return update
  }
}
