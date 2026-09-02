import type { Access } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { configFromAccess, configFromTestInput, exportLimitsForFormat } from './config'

const base: Access = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  groupId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  type: 'database',
  name: 'db',
  description: null,
  notes: null,
  username: 'u',
  credentialRef: null,
  url: null,
  links: [],
  icon: null,
  color: null,
  isFavorite: false,
  engine: 'postgres',
  host: '127.0.0.1',
  port: 5432,
  database: 'app',
  ssl: true,
  apiConfig: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('configFromAccess', () => {
  it('maps sqlite file path from host', () => {
    const config = configFromAccess({ ...base, engine: 'sqlite', host: ':memory:', port: null }, '')
    expect(config.engine).toBe('sqlite')
    expect(config.filePath).toBe(':memory:')
  })

  it('rejects unsupported engines', () => {
    expect(() => configFromAccess({ ...base, engine: 'redis' }, 'secret')).toThrow(
      /não abre sessão SQL/
    )
  })
})

describe('configFromTestInput', () => {
  it('uses the form payload, not a saved access', () => {
    const config = configFromTestInput({
      engine: 'postgres',
      host: 'form.example',
      port: 6543,
      database: 'from_form',
      username: 'form_user',
      ssl: false,
      password: 'secret'
    })
    expect(config.host).toBe('form.example')
    expect(config.port).toBe(6543)
    expect(config.database).toBe('from_form')
    expect(config.password).toBe('secret')
  })
})

describe('exportLimitsForFormat', () => {
  it('uses the pdf row cap only for pdf exports', () => {
    expect(exportLimitsForFormat('pdf').maxRows).toBe(5_000)
    expect(exportLimitsForFormat('csv').maxRows).toBe(100_000)
  })
})
