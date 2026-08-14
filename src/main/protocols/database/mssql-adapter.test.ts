import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MssqlAdapter } from './mssql-adapter'

type FakeRequest = {
  sql: string
  callback: (error: Error | null, rowCount?: number) => void
  emit: (event: string, payload: unknown) => boolean
}

const mocks = vi.hoisted(() => ({
  execSql: vi.fn()
}))

vi.mock('tedious', async () => {
  const { EventEmitter } = await import('node:events')

  class Request extends EventEmitter {
    sql: string
    callback: (error: Error | null, rowCount?: number) => void
    constructor(sql: string, callback: (error: Error | null, rowCount?: number) => void) {
      super()
      this.sql = sql
      this.callback = callback
    }
    cancel(): void {
      // no-op
    }
  }

  class Connection extends EventEmitter {
    connect(): void {
      this.emit('connect')
    }
    execSql(request: FakeRequest): void {
      mocks.execSql(request)
    }
    close(): void {
      this.emit('end')
    }
  }

  return { Connection, Request }
})

function emitResult(request: FakeRequest): void {
  if (request.sql.includes('INFORMATION_SCHEMA.TABLES') && !request.sql.includes('COLUMNS')) {
    request.emit('columnMetadata', [
      { colName: 'TABLE_SCHEMA' },
      { colName: 'TABLE_NAME' },
      { colName: 'TABLE_TYPE' }
    ])
    request.emit('row', [
      { metadata: { colName: 'TABLE_SCHEMA' }, value: 'dbo' },
      { metadata: { colName: 'TABLE_NAME' }, value: 'users' },
      { metadata: { colName: 'TABLE_TYPE' }, value: 'BASE TABLE' }
    ])
    request.callback(null, 1)
    return
  }
  if (request.sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
    request.emit('columnMetadata', [
      { colName: 'TABLE_SCHEMA' },
      { colName: 'TABLE_NAME' },
      { colName: 'COLUMN_NAME' },
      { colName: 'DATA_TYPE' },
      { colName: 'IS_NULLABLE' },
      { colName: 'IS_PRIMARY_KEY' }
    ])
    request.emit('row', [
      { metadata: { colName: 'TABLE_SCHEMA' }, value: 'dbo' },
      { metadata: { colName: 'TABLE_NAME' }, value: 'users' },
      { metadata: { colName: 'COLUMN_NAME' }, value: 'id' },
      { metadata: { colName: 'DATA_TYPE' }, value: 'int' },
      { metadata: { colName: 'IS_NULLABLE' }, value: 'NO' },
      { metadata: { colName: 'IS_PRIMARY_KEY' }, value: 1 }
    ])
    request.callback(null, 1)
    return
  }
  if (
    request.sql === 'BEGIN TRANSACTION' ||
    request.sql === 'COMMIT' ||
    request.sql === 'ROLLBACK'
  ) {
    request.callback(null, 0)
    return
  }
  request.emit('columnMetadata', [{ colName: 'ok' }])
  request.emit('row', [{ metadata: { colName: 'ok' }, value: 1 }])
  request.callback(null, 1)
}

describe('MssqlAdapter', () => {
  beforeEach(() => {
    mocks.execSql.mockReset().mockImplementation(emitResult)
  })

  it('introspects and queries with a mocked tedious connection', async () => {
    const adapter = new MssqlAdapter()
    await adapter.connect({
      engine: 'mssql',
      host: '127.0.0.1',
      port: 1433,
      database: 'app',
      username: 'u',
      password: 'p',
      ssl: false,
      filePath: null
    })

    const tree = await adapter.introspect()
    expect(tree.schemas[0]?.name).toBe('dbo')
    expect(tree.schemas[0]?.tables[0]?.name).toBe('users')
    expect(tree.schemas[0]?.tables[0]?.columns[0]).toEqual({
      name: 'id',
      dataType: 'int',
      nullable: false,
      primaryKey: true
    })

    const result = await adapter.query('SELECT 1', { maxRows: 1000, timeoutMs: 5000 })
    expect(result.rows).toEqual([{ ok: 1 }])

    await adapter.dispose()
  })

  it('uses BEGIN TRANSACTION when auto-commit is off', async () => {
    const sqls: string[] = []
    mocks.execSql.mockImplementation((request: FakeRequest) => {
      sqls.push(request.sql)
      emitResult(request)
    })

    const adapter = new MssqlAdapter()
    await adapter.connect({
      engine: 'mssql',
      host: '127.0.0.1',
      port: 1433,
      database: 'app',
      username: 'u',
      password: 'p',
      ssl: false,
      filePath: null
    })

    await adapter.setAutoCommit(false)
    await adapter.query('SELECT 1', { maxRows: 1000, timeoutMs: 5000 })
    expect(sqls[0]).toBe('BEGIN TRANSACTION')
    expect(adapter.getTxState().inTransaction).toBe(true)
    await adapter.commit()
    expect(sqls).toContain('COMMIT')
    expect(adapter.getTxState().inTransaction).toBe(false)
    await adapter.dispose()
  })
})
