import { randomUUID } from 'node:crypto'
import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/** Default columns seeded for the agent Kanban board on first migration. */
const DEFAULT_COLUMNS = ['Backlog', 'Em andamento', 'Concluído']

/**
 * Agent workspaces: a git worktree + agent CLI command pairing, tracked on a
 * Kanban board with user-defined columns (agent_board_columns) — deliberately
 * global (no client_id/group_id), unlike the rest of the schema; the repo
 * path is picked by the user and can be any git repo on disk.
 */
export const migration012AgentWorkspaces: Migration = {
  version: 12,
  name: '012-agent-workspaces',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE agent_board_columns (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE agent_workspaces (
        id TEXT PRIMARY KEY NOT NULL,
        repo_path TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        branch TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        agent_command TEXT NOT NULL,
        task_note TEXT,
        column_id TEXT REFERENCES agent_board_columns(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_agent_workspaces_column_id ON agent_workspaces(column_id);
    `)

    const now = new Date().toISOString()
    const insertColumn = db.prepare(`
      INSERT INTO agent_board_columns (id, name, sort_order, created_at, updated_at)
      VALUES (@id, @name, @sort_order, @created_at, @updated_at)
    `)
    DEFAULT_COLUMNS.forEach((name, index) => {
      insertColumn.run({
        id: randomUUID(),
        name,
        sort_order: index,
        created_at: now,
        updated_at: now
      })
    })
  }
}
