import { LOCAL_WORKSPACE_ID } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../database/test-utils'
import { WorkspacesRepository } from './workspaces-repository'

describe('WorkspacesRepository', () => {
  it('ships the local workspace out of the migration', () => {
    const repo = new WorkspacesRepository(createTestDatabase())
    const list = repo.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: LOCAL_WORKSPACE_ID, kind: 'local', serverUrl: null })
  })

  it('gets the local workspace by id and returns null for unknown ids', () => {
    const repo = new WorkspacesRepository(createTestDatabase())
    expect(repo.get(LOCAL_WORKSPACE_ID)?.kind).toBe('local')
    expect(repo.get('nope')).toBeNull()
  })

  it('keeps the local workspace first even when others sort before it', () => {
    const db = createTestDatabase()
    db.prepare(
      `INSERT INTO workspaces (id, name, kind, server_url, created_at)
       VALUES ('aaa', 'AAA', 'organization', 'https://a.example', '2000-01-01T00:00:00.000Z')`
    ).run()
    const repo = new WorkspacesRepository(db)
    expect(repo.list().map((w) => w.id)).toEqual([LOCAL_WORKSPACE_ID, 'aaa'])
  })

  it('refuses to store an organization without a server url', () => {
    const db = createTestDatabase()
    expect(() =>
      db
        .prepare(
          `INSERT INTO workspaces (id, name, kind, server_url, created_at)
           VALUES ('bad', 'Bad', 'organization', NULL, '2000-01-01T00:00:00.000Z')`
        )
        .run()
    ).toThrow()
  })
})

describe('WorkspacesRepository — organizations', () => {
  it('creates an organization with a slug id and finds it by server url', () => {
    const repo = new WorkspacesRepository(createTestDatabase())
    const org = repo.createOrganization({
      name: 'Acme Corp',
      serverUrl: 'https://north.acme.com',
      userEmail: 'ana@acme.com'
    })
    expect(org.id).toMatch(/^acme-corp-[a-z0-9]{4}$/)
    expect(repo.findByServerUrl('https://north.acme.com')?.id).toBe(org.id)
    expect(repo.findByServerUrl('https://other.example')).toBeNull()
  })

  it('makes a usable id out of names without latin letters', () => {
    const repo = new WorkspacesRepository(createTestDatabase())
    const org = repo.createOrganization({
      name: '北',
      serverUrl: 'https://x.example',
      userEmail: null
    })
    expect(org.id).toMatch(/^org-[a-z0-9]{4}$/)
  })

  it('stores and reads the refresh credential ref', () => {
    const repo = new WorkspacesRepository(createTestDatabase())
    const org = repo.createOrganization({
      name: 'A',
      serverUrl: 'https://a.example',
      userEmail: null
    })
    repo.setRefreshCredentialRef(org.id, 'ref-1')
    expect(repo.refreshCredentialRef(org.id)).toBe('ref-1')
  })

  it('deletes organizations but never the local workspace', () => {
    const repo = new WorkspacesRepository(createTestDatabase())
    const org = repo.createOrganization({
      name: 'A',
      serverUrl: 'https://a.example',
      userEmail: null
    })
    expect(repo.delete(org.id)).toBe(true)
    expect(repo.delete(LOCAL_WORKSPACE_ID)).toBe(false)
    expect(repo.get(LOCAL_WORKSPACE_ID)).not.toBeNull()
  })
})
