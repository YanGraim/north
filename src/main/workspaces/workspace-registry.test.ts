import { LOCAL_WORKSPACE_ID } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../database/test-utils'
import { createRepositories } from '../repositories'
import { WorkspacesRepository } from '../repositories/workspaces-repository'
import { createScopedRepositories, WorkspaceRegistry } from './workspace-registry'

function setup() {
  const db = createTestDatabase()
  const local = createRepositories(db)
  const workspaces = new WorkspacesRepository(db)
  const registry = new WorkspaceRegistry(workspaces, local)
  return { db, local, workspaces, registry }
}

function addOrganization(db: ReturnType<typeof createTestDatabase>, id = 'acme'): void {
  db.prepare(
    `INSERT INTO workspaces (id, name, kind, server_url, created_at)
     VALUES (?, 'Acme', 'organization', 'https://north.acme.com', '2026-10-20T00:00:00.000Z')`
  ).run(id)
}

describe('WorkspaceRegistry', () => {
  it('starts on the local workspace', () => {
    const { registry } = setup()
    expect(registry.activeId()).toBe(LOCAL_WORKSPACE_ID)
    expect(registry.activeSource().kind).toBe('local')
  })

  it('lists workspaces from the repository', () => {
    const { registry } = setup()
    expect(registry.list().map((w) => w.id)).toEqual([LOCAL_WORKSPACE_ID])
  })

  it('activates the local workspace and returns it', () => {
    const { registry } = setup()
    expect(registry.activate(LOCAL_WORKSPACE_ID).id).toBe(LOCAL_WORKSPACE_ID)
  })

  it('rejects an unknown workspace and keeps the current one active', () => {
    const { registry } = setup()
    expect(() => registry.activate('ghost')).toThrow(/not found/i)
    expect(registry.activeId()).toBe(LOCAL_WORKSPACE_ID)
  })

  it('rejects an invalid id before touching the repository', () => {
    const { registry } = setup()
    expect(() => registry.activate('../x')).toThrow()
  })

  it('refuses to activate an organization until the remote source exists', () => {
    const { db, registry } = setup()
    addOrganization(db)
    expect(() => registry.activate('acme')).toThrow(/not available/i)
    expect(registry.activeId()).toBe(LOCAL_WORKSPACE_ID)
  })

  it('hands the local repositories to the local source', () => {
    const { local, registry } = setup()
    expect(registry.repositoriesFor(LOCAL_WORKSPACE_ID)).toBe(local)
  })
})

describe('createScopedRepositories', () => {
  it('resolves each repository through the active workspace at call time', () => {
    const { local, registry } = setup()
    const scoped = createScopedRepositories(registry)
    expect(scoped.clients).toBe(local.clients)
    expect(scoped.tags).toBe(local.tags)
  })

  it('exposes every repository key of the local set', () => {
    const { local, registry } = setup()
    const scoped = createScopedRepositories(registry)
    expect(Object.keys(scoped).sort()).toEqual(Object.keys(local).sort())
  })

  it('reads and writes the local database through the scoped view', () => {
    const { local, registry } = setup()
    const scoped = createScopedRepositories(registry)
    const client = scoped.clients.create({ name: 'Acme', color: null })
    expect(local.clients.get(client.id)?.name).toBe('Acme')
  })
})
