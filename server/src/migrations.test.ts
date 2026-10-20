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
    expect(names).not.toContain('credential_ref')
  })
})
