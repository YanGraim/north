import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Workflows of an organization live on its North Server (REC-024), but each
 * person runs them here: the runs (with their logs' snapshots) and the git and
 * sudo passwords a run learns stay on this computer. Same shape as
 * `workflow_runs` / `connection_secrets`, without foreign keys, because the
 * workflow and the connection are on the server.
 */
export const migration024OrganizationWorkflowRuns: Migration = {
  version: 24,
  name: '024-organization-workflow-runs',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE organization_workflow_runs (
        id TEXT PRIMARY KEY NOT NULL,
        workflow_id TEXT NOT NULL,
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
      CREATE INDEX idx_organization_workflow_runs_group
        ON organization_workflow_runs(group_id, started_at);

      CREATE TABLE organization_connection_secrets (
        id TEXT PRIMARY KEY NOT NULL,
        connection_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        credential_ref TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (connection_id, kind)
      );
    `)
  }
}
