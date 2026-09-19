import type {
  AgentWorkspace,
  CreateAgentWorkspaceInput,
  UpdateAgentWorkspaceInput
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type AgentWorkspaceRow = {
  id: string
  repo_path: string
  repo_name: string
  branch: string
  worktree_path: string
  agent_command: string
  task_note: string | null
  column_id: string | null
  created_at: string
  updated_at: string
}

function mapWorkspace(row: AgentWorkspaceRow): AgentWorkspace {
  return {
    id: row.id,
    repoPath: row.repo_path,
    repoName: row.repo_name,
    branch: row.branch,
    worktreePath: row.worktree_path,
    agentCommand: row.agent_command,
    taskNote: row.task_note,
    columnId: row.column_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class AgentWorkspacesRepository {
  private readonly listStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listStmt = db.prepare(`
      SELECT id, repo_path, repo_name, branch, worktree_path, agent_command, task_note, column_id, created_at, updated_at
      FROM agent_workspaces
      ORDER BY created_at ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, repo_path, repo_name, branch, worktree_path, agent_command, task_note, column_id, created_at, updated_at
      FROM agent_workspaces
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO agent_workspaces
        (id, repo_path, repo_name, branch, worktree_path, agent_command, task_note, column_id, created_at, updated_at)
      VALUES
        (@id, @repo_path, @repo_name, @branch, @worktree_path, @agent_command, @task_note, @column_id, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE agent_workspaces
      SET task_note = @task_note, column_id = @column_id, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM agent_workspaces WHERE id = ?`)
  }

  list(): AgentWorkspace[] {
    return (this.listStmt.all() as AgentWorkspaceRow[]).map(mapWorkspace)
  }

  get(id: string): AgentWorkspace | null {
    const row = this.getStmt.get(id) as AgentWorkspaceRow | undefined
    return row ? mapWorkspace(row) : null
  }

  create(
    input: CreateAgentWorkspaceInput & { repoName: string; worktreePath: string }
  ): AgentWorkspace {
    const now = nowIso()
    const workspace: AgentWorkspace = {
      id: newId(),
      repoPath: input.repoPath,
      repoName: input.repoName,
      branch: input.branch,
      worktreePath: input.worktreePath,
      agentCommand: input.agentCommand,
      taskNote: input.taskNote ?? null,
      columnId: input.columnId ?? null,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: workspace.id,
      repo_path: workspace.repoPath,
      repo_name: workspace.repoName,
      branch: workspace.branch,
      worktree_path: workspace.worktreePath,
      agent_command: workspace.agentCommand,
      task_note: workspace.taskNote,
      column_id: workspace.columnId,
      created_at: workspace.createdAt,
      updated_at: workspace.updatedAt
    })
    return workspace
  }

  update(id: string, input: UpdateAgentWorkspaceInput): AgentWorkspace | null {
    const existing = this.get(id)
    if (!existing) return null
    const updated: AgentWorkspace = {
      ...existing,
      taskNote: input.taskNote === undefined ? existing.taskNote : input.taskNote,
      columnId: input.columnId === undefined ? existing.columnId : input.columnId,
      updatedAt: nowIso()
    }
    this.updateStmt.run({
      id: updated.id,
      task_note: updated.taskNote,
      column_id: updated.columnId,
      updated_at: updated.updatedAt
    })
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }
}
