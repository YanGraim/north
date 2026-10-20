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
})
