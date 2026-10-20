import {
  ClientSchema,
  ConnectionSchema,
  EnvironmentSchema,
  GroupSchema,
  TagSchema
} from '@shared/types'
import type { FastifyInstance } from 'fastify'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, login } from './test-utils'

let app: FastifyInstance
let auth: { authorization: string }

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  payload?: unknown
) {
  return app.inject({ method, url, headers: auth, payload: payload as object })
}

async function seedTree() {
  const client = (await call('POST', '/api/v1/clients', { name: 'Acme', color: '#f00' })).json()
  const env = (
    await call('POST', '/api/v1/environments', { clientId: client.id, name: 'Prod' })
  ).json()
  const group = (
    await call('POST', '/api/v1/groups', { environmentId: env.id, name: 'Web' })
  ).json()
  const conn = (
    await call('POST', '/api/v1/connections', {
      groupId: group.id,
      name: 'web-01',
      protocol: 'ssh',
      host: '10.0.0.1',
      port: 22,
      authMethod: 'password',
      username: 'root',
      links: [{ label: 'Docs', url: 'https://example.com' }]
    })
  ).json()
  return { client, env, group, conn }
}

beforeEach(async () => {
  ;({ app } = await createTestApp())
  ;({ auth } = await login(app))
})

describe('clients', () => {
  it('creates and lists clients sorted by name, matching the desktop contract', async () => {
    await call('POST', '/api/v1/clients', { name: 'Zeta' })
    const created = await call('POST', '/api/v1/clients', { name: 'alpha', notes: 'n' })
    expect(created.statusCode).toBe(201)
    expect(ClientSchema.parse(created.json())).toMatchObject({ name: 'alpha', notes: 'n' })
    const list = (await call('GET', '/api/v1/clients')).json()
    expect(list.map((c: { name: string }) => c.name)).toEqual(['alpha', 'Zeta'])
  })

  it('gets, updates and deletes a client', async () => {
    const { id } = (await call('POST', '/api/v1/clients', { name: 'Acme' })).json()
    expect((await call('GET', `/api/v1/clients/${id}`)).json().name).toBe('Acme')
    const updated = await call('PATCH', `/api/v1/clients/${id}`, { name: 'Acme Corp' })
    expect(updated.json().name).toBe('Acme Corp')
    expect(updated.json().updatedAt >= updated.json().createdAt).toBe(true)
    expect((await call('DELETE', `/api/v1/clients/${id}`)).statusCode).toBe(204)
    expect((await call('GET', `/api/v1/clients/${id}`)).statusCode).toBe(404)
  })

  it('rejects an empty name with a validation error', async () => {
    const res = await call('POST', '/api/v1/clients', { name: '' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('validation')
  })

  it('returns 404 for unknown and 400 for malformed ids', async () => {
    expect(
      (await call('GET', '/api/v1/clients/3f1c2b9e-1111-4222-8333-444455556666')).statusCode
    ).toBe(404)
    expect((await call('GET', '/api/v1/clients/not-a-uuid')).statusCode).toBe(400)
    expect(
      (await call('PATCH', '/api/v1/clients/3f1c2b9e-1111-4222-8333-444455556666', { name: 'x' }))
        .statusCode
    ).toBe(404)
    expect(
      (await call('DELETE', '/api/v1/clients/3f1c2b9e-1111-4222-8333-444455556666')).statusCode
    ).toBe(404)
  })
})

describe('environments and groups', () => {
  it('lists environments by client and groups by environment', async () => {
    const { client, env, group } = await seedTree()
    const other = (await call('POST', '/api/v1/clients', { name: 'Other' })).json()
    await call('POST', '/api/v1/environments', { clientId: other.id, name: 'Dev' })

    const envs = (await call('GET', `/api/v1/environments?clientId=${client.id}`)).json()
    expect(envs).toHaveLength(1)
    expect(EnvironmentSchema.parse(envs[0]).id).toBe(env.id)
    expect((await call('GET', '/api/v1/environments')).json()).toHaveLength(2)

    const groups = (await call('GET', `/api/v1/groups?environmentId=${env.id}`)).json()
    expect(GroupSchema.parse(groups[0]).id).toBe(group.id)
  })

  it('orders environments by sortOrder then name', async () => {
    const { client } = await seedTree()
    await call('POST', '/api/v1/environments', {
      clientId: client.id,
      name: 'A-first',
      sortOrder: -1
    })
    const names = (await call('GET', `/api/v1/environments?clientId=${client.id}`))
      .json()
      .map((e: { name: string }) => e.name)
    expect(names).toEqual(['A-first', 'Prod'])
  })

  it('refuses an environment for a client that does not exist', async () => {
    const res = await call('POST', '/api/v1/environments', {
      clientId: '3f1c2b9e-1111-4222-8333-444455556666',
      name: 'Prod'
    })
    expect(res.statusCode).toBe(404)
  })

  it('refuses a group for an environment that does not exist', async () => {
    const res = await call('POST', '/api/v1/groups', {
      environmentId: '3f1c2b9e-1111-4222-8333-444455556666',
      name: 'Web'
    })
    expect(res.statusCode).toBe(404)
  })

  it('updates environment color and group notes', async () => {
    const { env, group } = await seedTree()
    expect(
      (await call('PATCH', `/api/v1/environments/${env.id}`, { color: '#0f0' })).json().color
    ).toBe('#0f0')
    expect((await call('PATCH', `/api/v1/groups/${group.id}`, { notes: 'x' })).json().notes).toBe(
      'x'
    )
  })
})

describe('cascading deletes follow the hierarchy', () => {
  it('deleting a client removes its environments, groups and connections', async () => {
    const { client, env, group, conn } = await seedTree()
    await call('DELETE', `/api/v1/clients/${client.id}`)
    expect((await call('GET', `/api/v1/environments/${env.id}`)).statusCode).toBe(404)
    expect((await call('GET', `/api/v1/groups/${group.id}`)).statusCode).toBe(404)
    expect((await call('GET', `/api/v1/connections/${conn.id}`)).statusCode).toBe(404)
  })

  it('deleting a group removes only its connections', async () => {
    const { env, group, conn } = await seedTree()
    await call('DELETE', `/api/v1/groups/${group.id}`)
    expect((await call('GET', `/api/v1/connections/${conn.id}`)).statusCode).toBe(404)
    expect((await call('GET', `/api/v1/environments/${env.id}`)).statusCode).toBe(200)
  })
})

describe('connections', () => {
  it('creates a connection that satisfies the desktop schema', async () => {
    const { conn } = await seedTree()
    const parsed = ConnectionSchema.parse(conn)
    expect(parsed).toMatchObject({
      name: 'web-01',
      protocol: 'ssh',
      port: 22,
      links: [{ label: 'Docs', url: 'https://example.com' }],
      isFavorite: false,
      accessCount: 0,
      vpnMode: 'inherit'
    })
  })

  it('never stores a credential reference coming from a desktop vault', async () => {
    const { group } = await seedTree()
    const res = await call('POST', '/api/v1/connections', {
      groupId: group.id,
      name: 'db',
      protocol: 'ssh',
      host: 'h',
      port: 22,
      authMethod: 'password',
      credentialRef: '3f1c2b9e-1111-4222-8333-444455556666'
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().credentialRef).toBeNull()
  })

  it('ignores machine-local fields (private key path, local VPN profile)', async () => {
    const { group } = await seedTree()
    const res = await call('POST', '/api/v1/connections', {
      groupId: group.id,
      name: 'k',
      protocol: 'ssh',
      host: 'h',
      port: 22,
      authMethod: 'key',
      privateKeyPath: '/Users/ana/.ssh/id_ed25519',
      vpnProfileId: '3f1c2b9e-1111-4222-8333-444455556666'
    })
    expect(res.json().privateKeyPath).toBeNull()
    expect(res.json().vpnProfileId).toBeNull()
  })

  it('filters by group, environment and client', async () => {
    const a = await seedTree()
    const otherGroup = (
      await call('POST', '/api/v1/groups', { environmentId: a.env.id, name: 'Db' })
    ).json()
    await call('POST', '/api/v1/connections', {
      groupId: otherGroup.id,
      name: 'db-01',
      protocol: 'ssh',
      host: 'h',
      port: 22,
      authMethod: 'key'
    })
    expect((await call('GET', `/api/v1/connections?groupId=${a.group.id}`)).json()).toHaveLength(1)
    expect(
      (await call('GET', `/api/v1/connections?environmentId=${a.env.id}`)).json()
    ).toHaveLength(2)
    expect((await call('GET', `/api/v1/connections?clientId=${a.client.id}`)).json()).toHaveLength(
      2
    )
    expect((await call('GET', '/api/v1/connections')).json()).toHaveLength(2)
  })

  it('rejects an invalid protocol and a non-positive port', async () => {
    const { group } = await seedTree()
    const bad = { groupId: group.id, name: 'x', host: 'h', authMethod: 'none' }
    expect(
      (await call('POST', '/api/v1/connections', { ...bad, protocol: 'gopher', port: 22 }))
        .statusCode
    ).toBe(400)
    expect(
      (await call('POST', '/api/v1/connections', { ...bad, protocol: 'ssh', port: 0 })).statusCode
    ).toBe(400)
  })

  it('updates fields and can move to another group', async () => {
    const { env, conn } = await seedTree()
    const g2 = (await call('POST', '/api/v1/groups', { environmentId: env.id, name: 'G2' })).json()
    const res = await call('PATCH', `/api/v1/connections/${conn.id}`, {
      host: '10.0.0.2',
      groupId: g2.id,
      checklist: [{ id: '3f1c2b9e-1111-4222-8333-444455556666', text: 'backup', done: false }]
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ host: '10.0.0.2', groupId: g2.id })
    expect(res.json().checklist).toHaveLength(1)
  })

  it('duplicates a connection with a new id and a copy suffix', async () => {
    const { conn } = await seedTree()
    const res = await call('POST', `/api/v1/connections/${conn.id}/duplicate`)
    expect(res.statusCode).toBe(201)
    expect(res.json().id).not.toBe(conn.id)
    expect(res.json().name).toBe('web-01 (cópia)')
    expect(res.json().host).toBe(conn.host)
  })
})

describe('favorites are per user', () => {
  it('toggles favorite only for the caller', async () => {
    const { conn } = await seedTree()
    const fav = await call('POST', `/api/v1/connections/${conn.id}/favorite`)
    expect(fav.json().isFavorite).toBe(true)
    expect((await call('GET', '/api/v1/connections?isFavorite=true')).json()).toHaveLength(1)

    const bob = await login(app, 'bob@acme.com')
    const asBob = await app.inject({
      method: 'GET',
      url: `/api/v1/connections/${conn.id}`,
      headers: bob.auth
    })
    expect(asBob.json().isFavorite).toBe(false)

    const unfav = await call('POST', `/api/v1/connections/${conn.id}/favorite`)
    expect(unfav.json().isFavorite).toBe(false)
  })

  it('isFavorite=false lists the non-favorites', async () => {
    const { conn } = await seedTree()
    await call('POST', `/api/v1/connections/${conn.id}/favorite`)
    expect((await call('GET', '/api/v1/connections?isFavorite=false')).json()).toHaveLength(0)
  })
})

describe('tags', () => {
  it('creates, renames and deletes tags', async () => {
    const created = await call('POST', '/api/v1/tags', { name: 'linux', color: '#00f' })
    expect(created.statusCode).toBe(201)
    const tag = TagSchema.parse(created.json())
    expect((await call('PATCH', `/api/v1/tags/${tag.id}`, { name: 'ubuntu' })).json().name).toBe(
      'ubuntu'
    )
    expect((await call('DELETE', `/api/v1/tags/${tag.id}`)).statusCode).toBe(204)
    expect((await call('GET', '/api/v1/tags')).json()).toHaveLength(0)
  })

  it('refuses duplicate tag names (case-insensitive)', async () => {
    await call('POST', '/api/v1/tags', { name: 'linux' })
    const res = await call('POST', '/api/v1/tags', { name: 'Linux' })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('conflict')
  })

  it('sets and lists the tags of a connection, and filters connections by tag', async () => {
    const { conn } = await seedTree()
    const t1 = (await call('POST', '/api/v1/tags', { name: 'linux' })).json()
    const t2 = (await call('POST', '/api/v1/tags', { name: 'prod' })).json()
    const set = await call('PUT', `/api/v1/connections/${conn.id}/tags`, { tagIds: [t1.id, t2.id] })
    expect(set.json().map((t: { name: string }) => t.name)).toEqual(['linux', 'prod'])
    expect((await call('GET', `/api/v1/connections/${conn.id}/tags`)).json()).toHaveLength(2)
    expect((await call('GET', `/api/v1/connections?tagId=${t1.id}`)).json()).toHaveLength(1)

    await call('PUT', `/api/v1/connections/${conn.id}/tags`, { tagIds: [t2.id] })
    expect((await call('GET', `/api/v1/connections?tagId=${t1.id}`)).json()).toHaveLength(0)
  })

  it('deleting a tag detaches it from connections', async () => {
    const { conn } = await seedTree()
    const t = (await call('POST', '/api/v1/tags', { name: 'linux' })).json()
    await call('PUT', `/api/v1/connections/${conn.id}/tags`, { tagIds: [t.id] })
    await call('DELETE', `/api/v1/tags/${t.id}`)
    expect((await call('GET', `/api/v1/connections/${conn.id}/tags`)).json()).toHaveLength(0)
  })
})

describe('shared organization inventory', () => {
  it('every signed-in user sees the same tree (RBAC lands in phase 3)', async () => {
    await seedTree()
    const bob = await login(app, 'bob@acme.com')
    const res = await app.inject({ method: 'GET', url: '/api/v1/clients', headers: bob.auth })
    expect(res.json()).toHaveLength(1)
  })
})
