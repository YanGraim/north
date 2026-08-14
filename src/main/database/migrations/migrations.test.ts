import { describe, expect, it } from 'vitest'
import { openDatabase } from '../connection'
import { getUserVersion, migrate } from '../migrate'
import { migrations } from '../migrations'
import { migration001InitialSchema } from '../migrations/001-initial-schema'
import { migration002Credentials } from '../migrations/002-credentials'
import { migration003KnownHosts } from '../migrations/003-known-hosts'

describe('migrations', () => {
  it('applies all migrations and sets user_version to latest', () => {
    const db = openDatabase(':memory:')
    expect(getUserVersion(db)).toBe(0)

    migrate(db, migrations)

    expect(getUserVersion(db)).toBe(6)
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all() as Array<{ name: string }>

    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'clients',
        'environments',
        'groups',
        'connections',
        'accesses',
        'access_tags',
        'credentials',
        'tags',
        'connection_tags',
        'connection_history',
        'known_hosts',
        'group_variables',
        'workflows',
        'workflow_runs',
        'connection_secrets'
      ])
    )
  })

  it('is idempotent when already at latest version', () => {
    const db = openDatabase(':memory:')
    migrate(db, migrations)
    migrate(db, migrations)
    expect(getUserVersion(db)).toBe(6)
  })

  it('adds color column to environments from 005', () => {
    const db = openDatabase(':memory:')
    migrate(db, migrations)

    const columns = db.prepare(`PRAGMA table_info(environments)`).all() as Array<{
      name: string
    }>
    expect(columns.map((c) => c.name)).toContain('color')
  })

  it('creates expected connection columns from 001', () => {
    const db = openDatabase(':memory:')
    migrate(db, [migration001InitialSchema])

    const columns = db.prepare(`PRAGMA table_info(connections)`).all() as Array<{
      name: string
    }>
    const names = columns.map((c) => c.name)

    expect(names).toEqual(
      expect.arrayContaining([
        'description',
        'os',
        'icon',
        'color',
        'owner',
        'links',
        'vpn_required',
        'checklist',
        'related_files',
        'access_count',
        'total_connected_ms',
        'credential_ref'
      ])
    )
    expect(names).not.toContain('password')
  })

  it('creates credentials table from 002', () => {
    const db = openDatabase(':memory:')
    migrate(db, [migration001InitialSchema, migration002Credentials])

    const columns = db.prepare(`PRAGMA table_info(credentials)`).all() as Array<{
      name: string
    }>
    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'ciphertext', 'created_at', 'updated_at'])
    )
  })

  it('creates known_hosts table from 003', () => {
    const db = openDatabase(':memory:')
    migrate(db, [migration001InitialSchema, migration002Credentials, migration003KnownHosts])

    const columns = db.prepare(`PRAGMA table_info(known_hosts)`).all() as Array<{
      name: string
    }>
    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'id',
        'host',
        'port',
        'key_type',
        'fingerprint',
        'public_key',
        'created_at',
        'updated_at'
      ])
    )
  })

  it('creates accesses and access_tags from 004', () => {
    const db = openDatabase(':memory:')
    migrate(db, migrations)

    const columns = db.prepare(`PRAGMA table_info(accesses)`).all() as Array<{
      name: string
    }>
    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'id',
        'group_id',
        'type',
        'name',
        'username',
        'credential_ref',
        'url',
        'engine',
        'host',
        'port',
        'database_name',
        'ssl'
      ])
    )
    expect(columns.map((c) => c.name)).not.toContain('password')

    const junctions = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'access_tags'`)
      .all() as Array<{ name: string }>
    expect(junctions).toHaveLength(1)
  })

  it('creates workflow tables and migrates credential_ref into connection_secrets from 006', () => {
    const db = openDatabase(':memory:')
    migrate(db, migrations)

    for (const table of ['group_variables', 'workflows', 'workflow_runs', 'connection_secrets']) {
      const found = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get(table) as { name: string } | undefined
      expect(found?.name).toBe(table)
    }

    const runColumns = db.prepare(`PRAGMA table_info(workflow_runs)`).all() as Array<{
      name: string
    }>
    expect(runColumns.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'definition_snapshot',
        'variables_snapshot',
        'input_values',
        'targets',
        'mode',
        'status'
      ])
    )
  })
})
