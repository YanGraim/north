import { describe, expect, it } from 'vitest'
import { SqliteAdapter } from './sqlite-adapter'

describe('SqliteAdapter', () => {
  it('connects, introspects, queries and truncates rows', async () => {
    const adapter = new SqliteAdapter()
    await adapter.connect({
      engine: 'sqlite',
      host: ':memory:',
      port: null,
      database: null,
      username: null,
      password: '',
      ssl: false,
      filePath: ':memory:'
    })

    await adapter.ping()
    await adapter.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)', {
      maxRows: 1000,
      timeoutMs: 5000
    })
    await adapter.query(`INSERT INTO users (name) VALUES ('ada'), ('grace')`, {
      maxRows: 1000,
      timeoutMs: 5000
    })

    const tree = await adapter.introspect()
    expect(tree.schemas[0]?.name).toBe('main')
    const users = tree.schemas[0]?.tables.find((table) => table.name === 'users')
    expect(users?.columns).toEqual([
      { name: 'id', dataType: 'INTEGER', nullable: true, primaryKey: true },
      { name: 'name', dataType: 'TEXT', nullable: false, primaryKey: false }
    ])
    expect(users?.columns[0]?.primaryKey).toBe(true)
    expect(users?.columns[1]?.primaryKey).toBe(false)

    const select = await adapter.query('SELECT id, name FROM users ORDER BY id', {
      maxRows: 1000,
      timeoutMs: 5000
    })
    expect(select.rows).toEqual([
      { id: 1, name: 'ada' },
      { id: 2, name: 'grace' }
    ])
    expect(select.truncated).toBe(false)

    await adapter.query(`INSERT INTO users (name) VALUES ('a'), ('b'), ('c'), ('d')`, {
      maxRows: 1000,
      timeoutMs: 5000
    })
    const truncated = await adapter.query('SELECT name FROM users ORDER BY id', {
      maxRows: 2,
      timeoutMs: 5000
    })
    expect(truncated.rows).toHaveLength(2)
    expect(truncated.truncated).toBe(true)

    const insert = await adapter.query(`INSERT INTO users (name) VALUES ('eve')`, {
      maxRows: 1000,
      timeoutMs: 5000
    })
    expect(insert.affectedRows).toBe(1)
    expect(insert.rows).toEqual([])

    await adapter.dispose()
  })
})

describe('SqliteAdapter transactions', () => {
  it('defers mutations until commit when auto-commit is off', async () => {
    const adapter = new SqliteAdapter()
    await adapter.connect({
      engine: 'sqlite',
      host: ':memory:',
      port: null,
      database: null,
      username: null,
      password: '',
      ssl: false,
      filePath: ':memory:'
    })

    await adapter.query('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)', {
      maxRows: 1000,
      timeoutMs: 5000
    })

    await adapter.setAutoCommit(false)
    expect(adapter.getTxState()).toEqual({ autoCommit: false, inTransaction: false })

    await adapter.query(`INSERT INTO items (name) VALUES ('pending')`, {
      maxRows: 1000,
      timeoutMs: 5000
    })
    expect(adapter.getTxState().inTransaction).toBe(true)

    await adapter.rollback()
    expect(adapter.getTxState().inTransaction).toBe(false)

    const afterRollback = await adapter.query('SELECT name FROM items', {
      maxRows: 1000,
      timeoutMs: 5000
    })
    expect(afterRollback.rows).toEqual([])

    await adapter.setAutoCommit(false)
    await adapter.query(`INSERT INTO items (name) VALUES ('kept')`, {
      maxRows: 1000,
      timeoutMs: 5000
    })
    await adapter.commit()
    expect(adapter.getTxState().inTransaction).toBe(false)

    const afterCommit = await adapter.query('SELECT name FROM items', {
      maxRows: 1000,
      timeoutMs: 5000
    })
    expect(afterCommit.rows).toEqual([{ name: 'kept' }])

    await adapter.dispose()
  })
})
