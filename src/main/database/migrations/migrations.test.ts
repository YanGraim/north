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

    expect(getUserVersion(db)).toBe(9)
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
        'access_history',
        'known_hosts',
        'group_variables',
        'workflows',
        'workflow_runs',
        'connection_secrets',
        'api_collections',
        'api_folders',
        'api_requests',
        'api_variables',
        'api_request_history'
      ])
    )
  })

  it('is idempotent when already at latest version', () => {
    const db = openDatabase(':memory:')
    migrate(db, migrations)
    migrate(db, migrations)
    expect(getUserVersion(db)).toBe(9)
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
        'ssl',
        'api_config'
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

  it('creates api client tables and api_config on accesses from 008', () => {
    const db = openDatabase(':memory:')
    migrate(db, migrations)

    for (const table of [
      'api_collections',
      'api_folders',
      'api_requests',
      'api_variables',
      'api_request_history'
    ]) {
      const found = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get(table) as { name: string } | undefined
      expect(found?.name).toBe(table)
    }

    const columns = db.prepare(`PRAGMA table_info(accesses)`).all() as Array<{ name: string }>
    expect(columns.map((c) => c.name)).toContain('api_config')
  })

  it('009 scopes collections to client_id and drops access_id', () => {
    const db = openDatabase(':memory:')
    migrate(db, migrations)

    const columns = db.prepare(`PRAGMA table_info(api_collections)`).all() as Array<{
      name: string
    }>
    const names = columns.map((c) => c.name)
    expect(names).toContain('client_id')
    expect(names).not.toContain('access_id')
  })

  it('009 keeps folders when rebuilding collections that already exist', () => {
    const db = openDatabase(':memory:')
    migrate(
      db,
      migrations.filter((migration) => migration.version <= 8)
    )

    const now = '2026-01-01T00:00:00.000Z'
    db.exec(`
      INSERT INTO clients (id, name, notes, color, created_at, updated_at)
      VALUES ('c1', 'Acme', NULL, NULL, '${now}', '${now}');
      INSERT INTO environments (id, client_id, name, notes, sort_order, color, created_at, updated_at)
      VALUES ('e1', 'c1', 'HML', NULL, 0, NULL, '${now}', '${now}');
      INSERT INTO groups (id, environment_id, name, notes, sort_order, created_at, updated_at)
      VALUES ('g1', 'e1', 'api', NULL, 0, '${now}', '${now}');
      INSERT INTO accesses (
        id, group_id, type, name, url, is_favorite, created_at, updated_at
      ) VALUES (
        'a1', 'g1', 'api', 'Petstore', 'https://api.example.com', 0, '${now}', '${now}'
      );
      INSERT INTO api_collections (
        id, access_id, name, sort_order, created_at, updated_at
      ) VALUES (
        'col1', 'a1', 'WMS', 0, '${now}', '${now}'
      );
      INSERT INTO api_folders (
        id, collection_id, name, sort_order, created_at, updated_at
      ) VALUES (
        'f1', 'col1', 'Auth', 0, '${now}', '${now}'
      );
    `)

    migrate(db, migrations)

    const collection = db
      .prepare(`SELECT client_id, name FROM api_collections WHERE id = 'col1'`)
      .get() as {
      client_id: string
      name: string
    }
    expect(collection).toEqual({ client_id: 'c1', name: 'WMS' })
    const folder = db.prepare(`SELECT collection_id FROM api_folders WHERE id = 'f1'`).get() as {
      collection_id: string
    }
    expect(folder.collection_id).toBe('col1')
  })
})
