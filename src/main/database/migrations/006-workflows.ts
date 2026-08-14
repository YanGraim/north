import { randomUUID } from 'node:crypto'
import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Workflows domain: group_variables, workflows, workflow_runs (with snapshots),
 * and connection_secrets bag (migrates legacy connections.credential_ref).
 */
export const migration006Workflows: Migration = {
  version: 6,
  name: '006-workflows',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE group_variables (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (group_id, key)
      );

      CREATE TABLE workflows (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        preferred_connection_id TEXT REFERENCES connections(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        definition TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE workflow_runs (
        id TEXT PRIMARY KEY NOT NULL,
        workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        group_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        targets TEXT NOT NULL,
        definition_snapshot TEXT NOT NULL,
        variables_snapshot TEXT NOT NULL,
        input_values TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );

      CREATE TABLE connection_secrets (
        id TEXT PRIMARY KEY NOT NULL,
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        credential_ref TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (connection_id, kind)
      );

      CREATE INDEX idx_group_variables_group_id ON group_variables(group_id);
      CREATE INDEX idx_workflows_group_id ON workflows(group_id);
      CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
      CREATE INDEX idx_workflow_runs_group_id ON workflow_runs(group_id);
      CREATE INDEX idx_workflow_runs_started_at ON workflow_runs(started_at);
      CREATE INDEX idx_connection_secrets_connection_id ON connection_secrets(connection_id);
    `)

    // Migrate legacy credential_ref into the secrets bag.
    const rows = db
      .prepare(
        `SELECT id, auth_method, credential_ref, created_at, updated_at
         FROM connections
         WHERE credential_ref IS NOT NULL`
      )
      .all() as Array<{
      id: string
      auth_method: string
      credential_ref: string
      created_at: string
      updated_at: string
    }>

    const insertSecret = db.prepare(`
      INSERT OR IGNORE INTO connection_secrets
        (id, connection_id, kind, credential_ref, created_at, updated_at)
      VALUES (@id, @connection_id, @kind, @credential_ref, @created_at, @updated_at)
    `)

    for (const row of rows) {
      const kind = row.auth_method === 'key' ? 'passphrase' : 'password'
      insertSecret.run({
        id: randomUUID(),
        connection_id: row.id,
        kind,
        credential_ref: row.credential_ref,
        created_at: row.created_at,
        updated_at: row.updated_at
      })
    }
  }
}
