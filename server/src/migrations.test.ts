import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { createPgliteDb } from './db'
import { migrate, migrations } from './migrations'

describe('migrations', () => {
  it('applies every migration and records the version', async () => {
    const db = createPgliteDb(new PGlite())
    await migrate(db)
    const { rows } = await db.query<{ version: number }>(
      'SELECT max(version) AS version FROM schema_migrations'
    )
    expect(rows[0].version).toBe(migrations.at(-1)?.version)
  })

  it('is idempotent', async () => {
    const db = createPgliteDb(new PGlite())
    await migrate(db)
    await migrate(db)
    const { rows } = await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM schema_migrations'
    )
    expect(rows[0].n).toBe(migrations.length)
  })

  it('creates the inventory and auth tables', async () => {
    const db = createPgliteDb(new PGlite())
    await migrate(db)
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    )
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        'users',
        'refresh_tokens',
        'clients',
        'environments',
        'groups',
        'connections',
        'tags',
        'secrets',
        'audit_events',
        'connection_tags',
        'user_favorites'
      ])
    )
  })

  it('never has a column for plaintext secrets on connections', async () => {
    const db = createPgliteDb(new PGlite())
    await migrate(db)
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'connections'`
    )
    const names = rows.map((r) => r.column_name)
    expect(names).not.toContain('password')
    expect(names).not.toContain('secret')
  })

  it('keeps secrets only as wrapped ciphertext', async () => {
    const db = createPgliteDb(new PGlite())
    await migrate(db)
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'secrets'`
    )
    expect(rows.map((r) => r.column_name).sort()).toEqual(
      ['ciphertext', 'created_at', 'created_by', 'id', 'updated_at', 'wrapped_key'].sort()
    )
  })

  it('drops a secret when its connection goes away, even through a cascade', async () => {
    const db = createPgliteDb(new PGlite())
    await migrate(db)
    const ids = {
      client: '00000000-0000-4000-8000-000000000001',
      env: '00000000-0000-4000-8000-000000000002',
      group: '00000000-0000-4000-8000-000000000003',
      conn: '00000000-0000-4000-8000-000000000004',
      secret: '00000000-0000-4000-8000-000000000005'
    }
    await db.exec(`
      INSERT INTO clients (id, name) VALUES ('${ids.client}', 'c');
      INSERT INTO environments (id, client_id, name) VALUES ('${ids.env}', '${ids.client}', 'e');
      INSERT INTO groups (id, environment_id, name) VALUES ('${ids.group}', '${ids.env}', 'g');
      INSERT INTO secrets (id, wrapped_key, ciphertext) VALUES ('${ids.secret}', 'k', 'c');
      INSERT INTO connections (id, group_id, name, protocol, host, port, auth_method, credential_ref)
        VALUES ('${ids.conn}', '${ids.group}', 'n', 'ssh', 'h', 22, 'password', '${ids.secret}');
      DELETE FROM clients WHERE id = '${ids.client}';
    `)
    const { rows } = await db.query('SELECT id FROM secrets')
    expect(rows).toHaveLength(0)
  })

  it('008 keeps the grants made before teams existed', async () => {
    const db = createPgliteDb(new PGlite())
    await db.exec(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    )
    for (const m of migrations.filter((m) => m.version < 8)) {
      await db.exec(m.sql)
      await db.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
        m.version,
        m.name
      ])
    }
    const user = '00000000-0000-4000-8000-000000000010'
    const client = '00000000-0000-4000-8000-000000000011'
    await db.exec(`
      INSERT INTO users (id, email, name, role) VALUES ('${user}', 'bia@acme.com', 'Bia', 'member');
      INSERT INTO clients (id, name) VALUES ('${client}', 'c');
      INSERT INTO project_grants (user_id, scope_type, client_id, role)
        VALUES ('${user}', 'client', '${client}', 'editor');
    `)
    await migrate(db)
    const { rows } = await db.query<{ user_id: string; scope_id: string; role: string }>(
      'SELECT user_id, scope_id, role FROM project_grants'
    )
    expect(rows).toEqual([{ user_id: user, scope_id: client, role: 'editor' }])
  })

  it('009 keeps team and connection grants', async () => {
    const db = createPgliteDb(new PGlite())
    await db.exec(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    )
    for (const m of migrations.filter((m) => m.version < 9)) {
      await db.exec(m.sql)
      await db.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
        m.version,
        m.name
      ])
    }
    const team = '00000000-0000-4000-8000-000000000020'
    const client = '00000000-0000-4000-8000-000000000021'
    const grant = '00000000-0000-4000-8000-000000000022'
    await db.exec(`
      INSERT INTO teams (id, name) VALUES ('${team}', 'Suporte');
      INSERT INTO clients (id, name) VALUES ('${client}', 'c');
      INSERT INTO project_grants (id, team_id, scope_type, client_id, role)
        VALUES ('${grant}', '${team}', 'client', '${client}', 'viewer');
    `)
    await migrate(db)
    const { rows } = await db.query<{ id: string; team_id: string; scope_id: string }>(
      'SELECT id, team_id, scope_id FROM project_grants'
    )
    expect(rows).toEqual([{ id: grant, team_id: team, scope_id: client }])
  })
})
