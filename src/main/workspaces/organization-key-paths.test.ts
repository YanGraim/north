import type { Connection } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'
import type { InventoryStore } from './inventory-store'
import { withLocalKeyPaths } from './organization-key-paths'

const ORG = 'org-1'

/** Server-like store: keeps connections but always drops privateKeyPath. */
function serverStore(): InventoryStore {
  const rows = new Map<string, Connection>()
  let n = 0
  const save = (c: Connection) => {
    const stored = { ...c, privateKeyPath: null }
    rows.set(c.id, stored)
    return stored
  }
  return {
    connections: {
      list: async () => [...rows.values()],
      get: async (id) => rows.get(id) ?? null,
      create: async (input) => save({ ...(input as unknown as Connection), id: `c${++n}` }),
      update: async (id, input) => {
        const current = rows.get(id)
        return current ? save({ ...current, ...(input as Partial<Connection>) }) : null
      },
      delete: async (id) => rows.delete(id),
      toggleFavorite: async (id) => rows.get(id) ?? null,
      duplicate: async (id) => {
        const current = rows.get(id)
        return current ? save({ ...current, id: `c${++n}` }) : null
      }
    }
  } as InventoryStore
}

function setup() {
  const { db, repos } = createTestRepositories()
  db.prepare(
    `INSERT INTO workspaces (id, name, kind, server_url, created_at)
     VALUES (?, 'Org', 'organization', 'https://org.example', '2026-01-01T00:00:00.000Z')`
  ).run(ORG)
  return withLocalKeyPaths(serverStore(), repos.organizationKeyPaths, ORG)
}

const input = { name: 'web', protocol: 'ssh', host: 'h', port: 22, authMethod: 'key' } as const

describe('withLocalKeyPaths', () => {
  it('keeps the key path on this computer when the server drops it', async () => {
    const store = setup()
    const created = await store.connections.create({
      ...input,
      privateKeyPath: '~/.ssh/id_ed25519'
    } as never)
    expect(created.privateKeyPath).toBe('~/.ssh/id_ed25519')
    expect((await store.connections.get(created.id))?.privateKeyPath).toBe('~/.ssh/id_ed25519')
    expect((await store.connections.list())[0].privateKeyPath).toBe('~/.ssh/id_ed25519')
  })

  it('updates, clears and copies the path on duplicate', async () => {
    const store = setup()
    const { id } = await store.connections.create({ ...input, privateKeyPath: '~/.ssh/a' } as never)
    await store.connections.update(id, { name: 'renamed' })
    expect((await store.connections.get(id))?.privateKeyPath).toBe('~/.ssh/a')
    await store.connections.update(id, { privateKeyPath: '~/.ssh/b' })
    const copy = await store.connections.duplicate(id)
    expect(copy?.privateKeyPath).toBe('~/.ssh/b')
    await store.connections.update(id, { privateKeyPath: '' })
    expect((await store.connections.get(id))?.privateKeyPath).toBeNull()
  })
})
