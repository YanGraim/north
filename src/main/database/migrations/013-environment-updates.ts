import type { SqliteDatabase } from '../connection'
import type { Migration } from '../migrate'

/**
 * Optional Git tracking on Workflows: a workflow definition can carry a
 * `tracking` block (repository path on the remote host); the engine captures
 * the commit before/after a live run and, if it changed, records one
 * environment_updates row (commits that landed, files changed, result).
 * Never blocks or changes workflow execution — purely additive history.
 */
export const migration013EnvironmentUpdates: Migration = {
  version: 13,
  name: '013-environment-updates',
  up(db: SqliteDatabase): void {
    db.exec(`
      CREATE TABLE environment_updates (
        id TEXT PRIMARY KEY NOT NULL,
        environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        branch TEXT NOT NULL,
        previous_commit TEXT NOT NULL,
        current_commit TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        status TEXT NOT NULL,
        commits TEXT NOT NULL,
        files_changed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_environment_updates_environment
        ON environment_updates(environment_id, started_at DESC);
    `)
  }
}
