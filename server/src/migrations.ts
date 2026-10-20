import type { Db } from './db'

export type Migration = { version: number; name: string; sql: string }

/**
 * Versioned SQL, applied in a transaction at boot (same discipline as the
 * desktop's SQLite migrations). Inventory mirrors the desktop tree; per-user
 * state (favorites) lives in its own table. No secret columns: org secrets
 * arrive in phase 4 with envelope encryption.
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
