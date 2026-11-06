import type { Db } from './db'

export type Migration = { version: number; name: string; sql: string }

/**
 * Versioned SQL, applied in a transaction at boot (same discipline as the
 * desktop's SQLite migrations). Inventory mirrors the desktop tree; per-user
 * state (favorites) lives in its own table. Secrets (002) are envelope
 * encrypted and only ever leave the server through an audited reveal. Project
 * grants (003) give members editor/viewer access to part of the tree.
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: '001-auth-and-inventory',
    sql: `
      CREATE TABLE users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        disabled_at TIMESTAMPTZ
      );

      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        revoked_at TIMESTAMPTZ,
        replaced_by UUID
      );
      CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

      CREATE TABLE clients (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        notes TEXT,
        color TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE environments (
        id UUID PRIMARY KEY,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        notes TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_environments_client ON environments(client_id);

      CREATE TABLE groups (
        id UUID PRIMARY KEY,
        environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_groups_environment ON groups(environment_id);

      CREATE TABLE connections (
        id UUID PRIMARY KEY,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        protocol TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL CHECK (port > 0),
        username TEXT,
        auth_method TEXT NOT NULL,
        jump_host_id UUID REFERENCES connections(id) ON DELETE SET NULL,
        default_command TEXT,
        notes TEXT,
        os TEXT,
        icon TEXT,
        color TEXT,
        owner TEXT,
        links JSONB NOT NULL DEFAULT '[]',
        vpn_required BOOLEAN NOT NULL DEFAULT false,
        vpn_mode TEXT NOT NULL DEFAULT 'inherit',
        checklist JSONB NOT NULL DEFAULT '[]',
        related_files JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_connections_group ON connections(group_id);

      CREATE TABLE tags (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT
      );
      CREATE UNIQUE INDEX idx_tags_name ON tags(lower(name));

      CREATE TABLE connection_tags (
        connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (connection_id, tag_id)
      );

      CREATE TABLE user_favorites (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, connection_id)
      );
    `
  },
  {
    version: 2,
    name: '002-secrets-and-audit',
    sql: `
      -- Envelope-encrypted (ADR 0018 §8): per-secret data key wrapped by the master key.
      CREATE TABLE secrets (
        id UUID PRIMARY KEY,
        wrapped_key TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE connections
        ADD COLUMN credential_ref UUID REFERENCES secrets(id) ON DELETE SET NULL;
      CREATE INDEX idx_connections_credential ON connections(credential_ref);

      -- A secret lives and dies with its connection, including cascades from
      -- client/environment/group and a connection switching to another secret.
      CREATE FUNCTION drop_connection_secret() RETURNS trigger AS $$
      BEGIN
        IF OLD.credential_ref IS NOT NULL
           AND (TG_OP = 'DELETE' OR NEW.credential_ref IS DISTINCT FROM OLD.credential_ref) THEN
          DELETE FROM secrets WHERE id = OLD.credential_ref;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER connections_drop_secret
        AFTER DELETE OR UPDATE OF credential_ref ON connections
        FOR EACH ROW EXECUTE FUNCTION drop_connection_secret();

      CREATE TABLE audit_events (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id UUID,
        target_name TEXT,
        detail JSONB NOT NULL DEFAULT '{}'
      );
      CREATE INDEX idx_audit_events_at ON audit_events(at DESC);
    `
  },
  {
    version: 3,
    name: '003-project-grants',
    sql: `
      -- Editor/viewer per project (ADR 0018 §7). One FK per level so deleting
      -- the project, or the user, drops the grant.
      CREATE TABLE project_grants (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scope_type TEXT NOT NULL CHECK (scope_type IN ('client', 'environment', 'group')),
        client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
        environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
        group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
        scope_id UUID GENERATED ALWAYS AS (COALESCE(client_id, environment_id, group_id)) STORED,
        role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, scope_id),
        CHECK (num_nonnulls(client_id, environment_id, group_id) = 1),
        CHECK (
          (scope_type = 'client' AND client_id IS NOT NULL) OR
          (scope_type = 'environment' AND environment_id IS NOT NULL) OR
          (scope_type = 'group' AND group_id IS NOT NULL)
        )
      );
      CREATE INDEX idx_project_grants_scope ON project_grants(scope_id);
    `
  },
  {
    version: 4,
    name: '004-external-identity',
    sql: `
      -- Entra object id (ADR 0018 fase 0): stable per person, unlike the e-mail.
      ALTER TABLE users ADD COLUMN external_id TEXT UNIQUE;
    `
  },
  {
    version: 5,
    name: '005-connection-agent-forward',
    sql: `
      -- ssh-agent forwarding (ssh -A) per connection, off by default like OpenSSH.
      ALTER TABLE connections ADD COLUMN agent_forward BOOLEAN NOT NULL DEFAULT false;
    `
  },
  {
    version: 6,
    name: '006-connection-startup-directory',
    sql: `
      -- Optional remote directory an SSH connection opens in. Null keeps the login directory.
      ALTER TABLE connections ADD COLUMN startup_directory TEXT;
    `
  },
  {
    version: 7,
    name: '007-connection-log-files',
    sql: `
      -- Remote log files an SSH connection can follow. Empty list means none.
      ALTER TABLE connections ADD COLUMN log_files JSONB NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 8,
    name: '008-teams-and-connection-grants',
    sql: `
      -- Teams (ADR 0018 §7): access granted to a team reaches every member.
      -- entra_group_id keeps membership in sync with an Entra group at sign-in.
      CREATE TABLE teams (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        entra_group_id TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX idx_teams_name ON teams(lower(name));
      CREATE TABLE team_members (
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'entra')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (team_id, user_id)
      );
      CREATE INDEX idx_team_members_user ON team_members(user_id);

      -- Grants now go to a user or a team, and may target one connection.
      ALTER TABLE project_grants RENAME TO project_grants_v3;
      CREATE TABLE project_grants (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        scope_type TEXT NOT NULL
          CHECK (scope_type IN ('client', 'environment', 'group', 'connection')),
        client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
        environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
        group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
        connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
        scope_id UUID GENERATED ALWAYS AS
          (COALESCE(client_id, environment_id, group_id, connection_id)) STORED,
        role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (num_nonnulls(user_id, team_id) = 1),
        CHECK (num_nonnulls(client_id, environment_id, group_id, connection_id) = 1),
        CHECK (
          (scope_type = 'client' AND client_id IS NOT NULL) OR
          (scope_type = 'environment' AND environment_id IS NOT NULL) OR
          (scope_type = 'group' AND group_id IS NOT NULL) OR
          (scope_type = 'connection' AND connection_id IS NOT NULL)
        )
      );
      INSERT INTO project_grants
        (id, user_id, scope_type, client_id, environment_id, group_id, role, created_at)
      SELECT gen_random_uuid(), user_id, scope_type, client_id, environment_id, group_id, role,
             created_at
      FROM project_grants_v3;
      DROP TABLE project_grants_v3;
      CREATE UNIQUE INDEX idx_project_grants_user ON project_grants(user_id, scope_id)
        WHERE user_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_project_grants_team ON project_grants(team_id, scope_id)
        WHERE team_id IS NOT NULL;
      CREATE INDEX idx_project_grants_scope ON project_grants(scope_id);
    `
  },
  {
    version: 9,
    name: '009-accesses-and-vpns',
    sql: `
      -- VPN templates (REC-023): gateway, port and the like, shared by the
      -- organization. Never a username or password: each person signs in to
      -- the VPN with their own login, kept on their own computer.
      CREATE TABLE vpns (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        config JSONB NOT NULL,
        notes TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE clients ADD COLUMN vpn_id UUID REFERENCES vpns(id) ON DELETE SET NULL;
      ALTER TABLE environments ADD COLUMN vpn_id UUID REFERENCES vpns(id) ON DELETE SET NULL;
      ALTER TABLE connections ADD COLUMN vpn_id UUID REFERENCES vpns(id) ON DELETE SET NULL;

      -- Accesses (database, login/web portal, other) under a group, like connections.
      CREATE TABLE accesses (
        id UUID PRIMARY KEY,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('database', 'login', 'other')),
        name TEXT NOT NULL,
        description TEXT,
        notes TEXT,
        username TEXT,
        credential_ref UUID REFERENCES secrets(id) ON DELETE SET NULL,
        url TEXT,
        links JSONB NOT NULL DEFAULT '[]',
        icon TEXT,
        color TEXT,
        engine TEXT,
        host TEXT,
        port INTEGER CHECK (port > 0),
        database TEXT,
        ssl BOOLEAN,
        vpn_mode TEXT NOT NULL DEFAULT 'inherit',
        vpn_id UUID REFERENCES vpns(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_accesses_group ON accesses(group_id);
      CREATE INDEX idx_accesses_credential ON accesses(credential_ref);

      CREATE FUNCTION drop_access_secret() RETURNS trigger AS $$
      BEGIN
        IF OLD.credential_ref IS NOT NULL
           AND (TG_OP = 'DELETE' OR NEW.credential_ref IS DISTINCT FROM OLD.credential_ref) THEN
          DELETE FROM secrets WHERE id = OLD.credential_ref;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER accesses_drop_secret
        AFTER DELETE OR UPDATE OF credential_ref ON accesses
        FOR EACH ROW EXECUTE FUNCTION drop_access_secret();

      CREATE TABLE access_tags (
        access_id UUID NOT NULL REFERENCES accesses(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (access_id, tag_id)
      );
      CREATE TABLE user_access_favorites (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_id UUID NOT NULL REFERENCES accesses(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, access_id)
      );

      -- Grants may now target one access, too.
      ALTER TABLE project_grants RENAME TO project_grants_v8;
      DROP INDEX idx_project_grants_user;
      DROP INDEX idx_project_grants_team;
      DROP INDEX idx_project_grants_scope;
      CREATE TABLE project_grants (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        scope_type TEXT NOT NULL
          CHECK (scope_type IN ('client', 'environment', 'group', 'connection', 'access')),
        client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
        environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
        group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
        connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
        access_id UUID REFERENCES accesses(id) ON DELETE CASCADE,
        scope_id UUID GENERATED ALWAYS AS
          (COALESCE(client_id, environment_id, group_id, connection_id, access_id)) STORED,
        role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (num_nonnulls(user_id, team_id) = 1),
        CHECK (num_nonnulls(client_id, environment_id, group_id, connection_id, access_id) = 1),
        CHECK (
          (scope_type = 'client' AND client_id IS NOT NULL) OR
          (scope_type = 'environment' AND environment_id IS NOT NULL) OR
          (scope_type = 'group' AND group_id IS NOT NULL) OR
          (scope_type = 'connection' AND connection_id IS NOT NULL) OR
          (scope_type = 'access' AND access_id IS NOT NULL)
        )
      );
      INSERT INTO project_grants
        (id, user_id, team_id, scope_type, client_id, environment_id, group_id, connection_id,
         role, created_at)
      SELECT id, user_id, team_id, scope_type, client_id, environment_id, group_id, connection_id,
             role, created_at
      FROM project_grants_v8;
      DROP TABLE project_grants_v8;
      CREATE UNIQUE INDEX idx_project_grants_user ON project_grants(user_id, scope_id)
        WHERE user_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_project_grants_team ON project_grants(team_id, scope_id)
        WHERE team_id IS NOT NULL;
      CREATE INDEX idx_project_grants_scope ON project_grants(scope_id);
    `
  },
  {
    // REC-024: workflows and group variables live in the organization; each
    // person runs them on their own computer (runs and git/sudo passwords stay
    // there). Environment updates record who ran them, for the whole team.
    version: 10,
    name: '010-workflows',
    sql: `
      CREATE TABLE workflows (
        id UUID PRIMARY KEY,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        preferred_connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        definition JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_workflows_group ON workflows(group_id);

      CREATE TABLE group_variables (
        id UUID PRIMARY KEY,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (group_id, key)
      );

      CREATE TABLE environment_updates (
        id UUID PRIMARY KEY,
        environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
        connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        -- the run itself stays on the computer that ran it
        workflow_run_id UUID NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        branch TEXT NOT NULL,
        previous_commit TEXT NOT NULL,
        current_commit TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        finished_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
        commits JSONB NOT NULL,
        files_changed INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_environment_updates_env ON environment_updates(environment_id, started_at DESC);
      CREATE INDEX idx_environment_updates_started ON environment_updates(started_at DESC);
    `
  }
]

export async function migrate(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  const { rows } = await db.query<{ version: number }>('SELECT version FROM schema_migrations')
  const applied = new Set(rows.map((r) => r.version))
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue
    await db.transaction(async (tx) => {
      await tx.exec(migration.sql)
      await tx.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
        migration.version,
        migration.name
      ])
    })
  }
}
