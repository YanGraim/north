import {
  ClientSchema,
  ConnectionSchema,
  EnvironmentSchema,
  GroupSchema,
  TagSchema
} from '@shared/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { memoryTokenStore, OrganizationClient } from './organization-client'
import { RemoteInventoryStore } from './remote-inventory-store'
import { startTestServer } from './test-server'

let server: Awaited<ReturnType<typeof startTestServer>>
let store: RemoteInventoryStore

beforeAll(async () => {
  server = await startTestServer()
  const client = new OrganizationClient(server.url, memoryTokenStore())
  await client.devLogin('ana@acme.com')
  store = new RemoteInventoryStore(client)
}, 60_000)

afterAll(async () => {
  await server.stop()
})

async function tree() {
  const client = await store.clients.create({ name: `Acme ${Math.random()}` })
  const env = await store.environments.create({ clientId: client.id, name: 'Prod' })
  const group = await store.groups.create({ environmentId: env.id, name: 'Web' })
  const conn = await store.connections.create({
    groupId: group.id,
    name: 'web-01',
    protocol: 'ssh',
    host: '10.0.0.1',
    port: 22,
    authMethod: 'key'
  })
  return { client, env, group, conn }
}

describe('RemoteInventoryStore', () => {
  it('round-trips the whole tree with desktop-shaped entities', async () => {
    const { client, env, group, conn } = await tree()
    ClientSchema.parse(await store.clients.get(client.id))
    EnvironmentSchema.parse((await store.environments.list(client.id))[0])
    GroupSchema.parse((await store.groups.list(env.id))[0])
    ConnectionSchema.parse((await store.connections.list({ groupId: group.id }))[0])
    expect((await store.connections.get(conn.id))?.host).toBe('10.0.0.1')
  })

  it('returns null for missing entities instead of throwing', async () => {
    const missing = '3f1c2b9e-1111-4222-8333-444455556666'
    expect(await store.clients.get(missing)).toBeNull()
    expect(await store.environments.get(missing)).toBeNull()
    expect(await store.groups.get(missing)).toBeNull()
    expect(await store.connections.get(missing)).toBeNull()
    expect(await store.clients.update(missing, { name: 'x' })).toBeNull()
  })

  it('updates, favorites, duplicates and deletes connections', async () => {
    const { conn } = await tree()
    expect((await store.connections.update(conn.id, { host: 'h2' }))?.host).toBe('h2')
    expect((await store.connections.toggleFavorite(conn.id))?.isFavorite).toBe(true)
    const copy = await store.connections.duplicate(conn.id)
    expect(copy?.id).not.toBe(conn.id)
    expect(await store.connections.delete(conn.id)).toBe(true)
    expect(await store.connections.delete(conn.id)).toBe(false)
  })

  it('filters favorites and tags through the query string', async () => {
    const { conn, client } = await tree()
    await store.connections.toggleFavorite(conn.id)
    const favs = await store.connections.list({ clientId: client.id, isFavorite: true })
    expect(favs.map((c) => c.id)).toEqual([conn.id])
    const tag = TagSchema.parse(await store.tags.create({ name: `t-${Math.random()}` }))
    await store.tags.setForConnection({ connectionId: conn.id, tagIds: [tag.id] })
    expect((await store.connections.list({ tagId: tag.id })).map((c) => c.id)).toEqual([conn.id])
    expect(await store.tags.listForConnection(conn.id)).toHaveLength(1)
  })

  it('cascades a client delete on the server', async () => {
    const { client, conn } = await tree()
    expect(await store.clients.delete(client.id)).toBe(true)
    expect(await store.connections.get(conn.id)).toBeNull()
  })

  it('has no access tags in organizations yet', async () => {
    expect(await store.tags.listForAccess('3f1c2b9e-1111-4222-8333-444455556666')).toEqual([])
    await expect(
      store.tags.setForAccess({ accessId: '3f1c2b9e-1111-4222-8333-444455556666', tagIds: [] })
    ).rejects.toThrow(/organiza/i)
  })
})
