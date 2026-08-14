import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MysqlAdapter } from './mysql-adapter'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  destroy: vi.fn(),
  end: vi.fn(),
  createConnection: vi.fn()
}))

vi.mock('mysql2/promise', () => ({
  default: {
    createConnection: mocks.createConnection
  }
}))

describe('MysqlAdapter', () => {
  beforeEach(() => {
    mocks.query.mockReset()
    mocks.destroy.mockReset()
    mocks.end.mockReset().mockResolvedValue(undefined)
    mocks.createConnection.mockReset().mockResolvedValue({
      query: mocks.query,
      destroy: mocks.destroy,
      end: mocks.end
    })
  })

  it('introspects and queries with a mocked mysql2 client', async () => {
    mocks.query.mockImplementation(async (sql: unknown) => {
      const text = typeof sql === 'string' ? sql : String((sql as { sql?: string }).sql ?? '')
      if (text.includes('information_schema.tables') && !text.includes('columns')) {
        return [[{ table_schema: 'app', table_name: 'orders', table_type: 'BASE TABLE' }], []]
      }
      if (text.includes('information_schema.columns')) {
        return [
          [
            {
              table_schema: 'app',
              table_name: 'orders',
              column_name: 'sku',
              data_type: 'varchar',
              is_nullable: 'YES',
              column_key: ''
            }
          ],
          []
        ]
      }
      return [[{ ok: 1 }], [{ name: 'ok' }]]
    })

    const adapter = new MysqlAdapter()
    await adapter.connect({
      engine: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      database: 'app',
      username: 'u',
      password: 'p',
      ssl: false,
      filePath: null
    })

    const tree = await adapter.introspect()
    expect(tree.schemas[0]?.name).toBe('app')
    expect(tree.schemas[0]?.tables[0]?.columns[0]).toEqual({
      name: 'sku',
      dataType: 'varchar',
      nullable: true,
      primaryKey: false
    })

    const result = await adapter.query('SELECT 1', { maxRows: 1000, timeoutMs: 5000 })
    expect(result.rows).toEqual([{ ok: 1 }])

    await adapter.dispose()
    expect(mocks.end).toHaveBeenCalled()
  })

  it('starts a transaction with START TRANSACTION when auto-commit is off', async () => {
    const calls: string[] = []
    mocks.query.mockImplementation(async (sql: unknown) => {
      const text = typeof sql === 'string' ? sql : String((sql as { sql?: string }).sql ?? '')
      calls.push(text)
      return [[{ ok: 1 }], [{ name: 'ok' }]]
    })

    const adapter = new MysqlAdapter()
    await adapter.connect({
      engine: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      database: 'app',
      username: 'u',
      password: 'p',
      ssl: false,
      filePath: null
    })

    await adapter.setAutoCommit(false)
    await adapter.query('SELECT 1', { maxRows: 1000, timeoutMs: 5000 })
    expect(calls[0]).toBe('START TRANSACTION')
    expect(adapter.getTxState().inTransaction).toBe(true)
    await adapter.rollback()
    expect(calls).toContain('ROLLBACK')
    expect(adapter.getTxState().inTransaction).toBe(false)
    await adapter.dispose()
  })
})
