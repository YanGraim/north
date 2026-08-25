import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PostgresAdapter, pgBool } from './postgres-adapter'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn()
}))

vi.mock('pg', () => ({
  Client: class {
    processID = 42
    connect = mocks.connect
    query = mocks.query
    end = mocks.end
  }
}))

describe('PostgresAdapter', () => {
  beforeEach(() => {
    mocks.connect.mockReset().mockResolvedValue(undefined)
    mocks.end.mockReset().mockResolvedValue(undefined)
    mocks.query.mockReset()
  })

  it('treats postgres bool-like values correctly', () => {
    expect(pgBool(true)).toBe(true)
    expect(pgBool('t')).toBe(true)
    expect(pgBool('true')).toBe(true)
    expect(pgBool(false)).toBe(false)
    expect(pgBool('f')).toBe(false)
    expect(pgBool('false')).toBe(false)
    expect(pgBool(null)).toBe(false)
  })

  it('introspects primary keys via pg_catalog and queries with a mocked pg client', async () => {
    mocks.query.mockImplementation(async (sql: unknown) => {
      const text = typeof sql === 'string' ? sql : String((sql as { text?: string }).text ?? '')
      if (text.includes('information_schema.tables') && !text.includes('columns')) {
        return {
          rows: [{ table_schema: 'public', table_name: 'users', table_type: 'BASE TABLE' }]
        }
      }
      if (text.includes('information_schema.columns')) {
        return {
          rows: [
            {
              table_schema: 'public',
              table_name: 'users',
              column_name: 'id',
              data_type: 'integer',
              is_nullable: 'NO'
            },
            {
              table_schema: 'public',
              table_name: 'users',
              column_name: 'name',
              data_type: 'text',
              is_nullable: 'YES'
            }
          ]
        }
      }
      if (text.includes('pg_index')) {
        expect(text).toContain('indisprimary')
        return {
          rows: [{ table_schema: 'public', table_name: 'users', column_name: 'ID' }]
        }
      }
      return {
        rows: [[1]],
        fields: [{ name: 'ok' }],
        rowCount: 1
      }
    })

    const adapter = new PostgresAdapter()
    await adapter.connect({
      engine: 'postgres',
      host: '127.0.0.1',
      port: 5432,
      database: 'app',
      username: 'u',
      password: 'p',
      ssl: false,
      filePath: null
    })

    const tree = await adapter.introspect()
    expect(tree.schemas[0]?.name).toBe('public')
    expect(tree.schemas[0]?.tables[0]?.name).toBe('users')
    expect(tree.schemas[0]?.tables[0]?.columns[0]).toEqual({
      name: 'id',
      dataType: 'integer',
      nullable: false,
      primaryKey: true,
      characterMaximumLength: null
    })
    expect(tree.schemas[0]?.tables[0]?.columns[1]?.primaryKey).toBe(false)

    const result = await adapter.query('SELECT 1', { maxRows: 1000, timeoutMs: 5000 })
    expect(result.rows).toEqual([{ ok: 1 }])
    expect(result.truncated).toBe(false)

    await adapter.dispose()
    expect(mocks.end).toHaveBeenCalled()
  })

  it('begins a transaction when auto-commit is off and rolls back on dispose', async () => {
    const calls: string[] = []
    mocks.query.mockImplementation(async (sql: unknown) => {
      const text = typeof sql === 'string' ? sql : String((sql as { text?: string }).text ?? '')
      calls.push(text)
      return { rows: [[1]], fields: [{ name: 'ok' }], rowCount: 1 }
    })

    const adapter = new PostgresAdapter()
    await adapter.connect({
      engine: 'postgres',
      host: '127.0.0.1',
      port: 5432,
      database: 'app',
      username: 'u',
      password: 'p',
      ssl: false,
      filePath: null
    })

    expect(adapter.getTxState()).toEqual({ autoCommit: true, inTransaction: false })
    await adapter.setAutoCommit(false)
    expect(adapter.getTxState()).toEqual({ autoCommit: false, inTransaction: false })

    await adapter.query('SELECT 1', { maxRows: 1000, timeoutMs: 5000 })
    expect(calls[0]).toBe('BEGIN')
    expect(calls[1]).toContain('SELECT 1')
    expect(adapter.getTxState()).toEqual({ autoCommit: false, inTransaction: true })
    await expect(adapter.setAutoCommit(true)).rejects.toThrow(/Commit ou Rollback/)

    await adapter.dispose()
    expect(calls.some((sql) => sql === 'ROLLBACK')).toBe(true)
    expect(mocks.end).toHaveBeenCalled()
  })

  it('commits and clears inTransaction', async () => {
    mocks.query.mockResolvedValue({ rows: [[1]], fields: [{ name: 'ok' }], rowCount: 1 })

    const adapter = new PostgresAdapter()
    await adapter.connect({
      engine: 'postgres',
      host: '127.0.0.1',
      port: 5432,
      database: 'app',
      username: 'u',
      password: 'p',
      ssl: false,
      filePath: null
    })
    await adapter.setAutoCommit(false)
    await adapter.query('SELECT 1', { maxRows: 1000, timeoutMs: 5000 })
    await adapter.commit()
    expect(adapter.getTxState()).toEqual({ autoCommit: false, inTransaction: false })
    await adapter.setAutoCommit(true)
    expect(adapter.getTxState()).toEqual({ autoCommit: true, inTransaction: false })
    await adapter.dispose()
  })
})
