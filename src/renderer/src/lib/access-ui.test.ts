import type { Access } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { buildConnectionString, sqlStudioReady, supportsSqlStudio } from './access-ui'

function access(partial: Partial<Access> & Pick<Access, 'engine' | 'host' | 'port'>): Access {
  return {
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
    database: 'app',
    ssl: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

describe('supportsSqlStudio', () => {
  it('is true only for database accesses with a SQL engine', () => {
    expect(supportsSqlStudio(access({ engine: 'postgres', host: 'h', port: 5432 }))).toBe(true)
    expect(supportsSqlStudio(access({ engine: 'mysql', host: 'h', port: 3306 }))).toBe(true)
    expect(supportsSqlStudio(access({ engine: 'redis', host: 'h', port: 6379 }))).toBe(false)
    expect(
      supportsSqlStudio({
        ...access({ engine: 'postgres', host: 'h', port: 5432 }),
        type: 'login'
      })
    ).toBe(false)
  })
})

describe('sqlStudioReady', () => {
  it('requires host+port except sqlite (file path in host)', () => {
    expect(sqlStudioReady(access({ engine: 'postgres', host: 'db.local', port: 5432 }))).toBe(true)
    expect(sqlStudioReady(access({ engine: 'postgres', host: 'db.local', port: null }))).toBe(false)
    expect(sqlStudioReady(access({ engine: 'sqlite', host: '/tmp/app.db', port: null }))).toBe(true)
    expect(sqlStudioReady(access({ engine: 'sqlite', host: '', port: null }))).toBe(false)
  })
})

describe('buildConnectionString', () => {
  it('builds sqlite from the file path stored in host', () => {
    expect(
      buildConnectionString(access({ engine: 'sqlite', host: '/tmp/app.db', port: null }))
    ).toBe('sqlite:/tmp/app.db')
  })
})
