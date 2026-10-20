import type { FastifyInstance } from 'fastify'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, login } from './test-utils'

/**
 * Roles per project (ADR 0018 §7): admin is global; editor and viewer are
 * granted on a client, environment or group and flow down the tree.
 */

type Headers = { authorization: string }
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

let app: FastifyInstance
let admin: Headers
let bia: Headers // member
let biaId: string

const call = (headers: Headers, method: Method, url: string, payload?: unknown) =>
  app.inject({ method, url, headers, payload: payload as object })

const body = async (headers: Headers, method: Method, url: string, payload?: unknown) => {
  const res = await call(headers, method, url, payload)
  if (res.statusCode >= 300) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body}`)
  return res.statusCode === 204 ? null : res.json()
}

async function tree(name: string) {
  const client = await body(admin, 'POST', '/api/v1/clients', { name })
  const env = await body(admin, 'POST', '/api/v1/environments', {
    clientId: client.id,
    name: 'Prod'
  })
  const group = await body(admin, 'POST', '/api/v1/groups', { environmentId: env.id, name: 'Web' })
  const secret = await body(admin, 'POST', '/api/v1/secrets', { value: `${name}-pass` })
  const conn = await body(admin, 'POST', '/api/v1/connections', {
    groupId: group.id,
    name: `${name}-01`,
    protocol: 'ssh',
    host: '10.0.0.1',
    port: 22,
    authMethod: 'password',
    credentialRef: secret.id
  })
  return { client, env, group, conn, secret: secret.id as string }
}

const grant = (scopeType: string, scopeId: string, role: string, userId = biaId) =>
  body(admin, 'PUT', '/api/v1/admin/grants', { userId, scopeType, scopeId, role })

const newConnection = (headers: Headers, groupId: string, extra: object = {}) =>
  call(headers, 'POST', '/api/v1/connections', {
    groupId,
    name: 'new',
    protocol: 'ssh',
    host: '10.0.0.2',
    port: 22,
    authMethod: 'password',
    ...extra
  })

const names = (rows: Array<{ name: string }>) => rows.map((r) => r.name).sort()

beforeEach(async () => {
  ;({ app } = await createTestApp())
  ;({ auth: admin } = await login(app, 'ana@acme.com'))
  const member = await login(app, 'bia@acme.com')
  bia = member.auth
  biaId = (await body(bia, 'GET', '/api/v1/me')).id
})

describe('a member without grants', () => {
  it('sees an empty organization', async () => {
    await tree('Acme')
    expect(await body(bia, 'GET', '/api/v1/clients')).toEqual([])
    expect(await body(bia, 'GET', '/api/v1/environments')).toEqual([])
    expect(await body(bia, 'GET', '/api/v1/groups')).toEqual([])
    expect(await body(bia, 'GET', '/api/v1/connections')).toEqual([])
  })

  it('gets 404 for items it cannot see, not 403, so ids do not leak', async () => {
    const { client, conn, secret } = await tree('Acme')
    expect((await call(bia, 'GET', `/api/v1/clients/${client.id}`)).statusCode).toBe(404)
    expect((await call(bia, 'GET', `/api/v1/connections/${conn.id}`)).statusCode).toBe(404)
    expect((await call(bia, 'DELETE', `/api/v1/connections/${conn.id}`)).statusCode).toBe(404)
    expect(
      (await call(bia, 'POST', `/api/v1/secrets/${secret}/reveal`, { purpose: 'session' }))
        .statusCode
    ).toBe(404)
  })

  it('cannot create a client; only admins add projects', async () => {
    const res = await call(bia, 'POST', '/api/v1/clients', { name: 'Mine' })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('forbidden')
  })
})

describe('viewer', () => {
  it('sees only the granted project, with the path down to it', async () => {
    const acme = await tree('Acme')
    await tree('Other')
    await grant('group', acme.group.id, 'viewer')
    expect(names(await body(bia, 'GET', '/api/v1/clients'))).toEqual(['Acme'])
    expect(names(await body(bia, 'GET', '/api/v1/environments'))).toEqual(['Prod'])
    expect(names(await body(bia, 'GET', '/api/v1/groups'))).toEqual(['Web'])
    expect(names(await body(bia, 'GET', '/api/v1/connections'))).toEqual(['Acme-01'])
  })

  it('a grant on a client covers everything under it', async () => {
    const acme = await tree('Acme')
    const extraGroup = await body(admin, 'POST', '/api/v1/groups', {
      environmentId: acme.env.id,
      name: 'Db'
    })
    await grant('client', acme.client.id, 'viewer')
    expect(names(await body(bia, 'GET', '/api/v1/groups'))).toEqual(['Db', 'Web'])
    expect((await call(bia, 'GET', `/api/v1/groups/${extraGroup.id}`)).statusCode).toBe(200)
  })

  it('cannot change anything', async () => {
    const acme = await tree('Acme')
    await grant('client', acme.client.id, 'viewer')
    const denied = [
      await call(bia, 'PATCH', `/api/v1/clients/${acme.client.id}`, { name: 'x' }),
      await call(bia, 'POST', '/api/v1/environments', { clientId: acme.client.id, name: 'x' }),
      await call(bia, 'DELETE', `/api/v1/groups/${acme.group.id}`),
      await newConnection(bia, acme.group.id),
      await call(bia, 'PATCH', `/api/v1/connections/${acme.conn.id}`, { name: 'x' }),
      await call(bia, 'DELETE', `/api/v1/connections/${acme.conn.id}`),
      await call(bia, 'POST', `/api/v1/connections/${acme.conn.id}/duplicate`),
      await call(bia, 'PUT', `/api/v1/connections/${acme.conn.id}/tags`, { tagIds: [] }),
      await call(bia, 'PUT', `/api/v1/secrets/${acme.secret}`, { value: 'x' }),
      await call(bia, 'DELETE', `/api/v1/secrets/${acme.secret}`)
    ]
    expect(denied.map((r) => r.statusCode)).toEqual(Array(denied.length).fill(403))
  })

  it('can still favorite a connection, which is personal', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'viewer')
    const res = await call(bia, 'POST', `/api/v1/connections/${acme.conn.id}/favorite`)
    expect(res.statusCode).toBe(200)
    expect(res.json().isFavorite).toBe(true)
  })

  it('opens sessions but never sees the password itself', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'viewer')
    const session = await call(bia, 'POST', `/api/v1/secrets/${acme.secret}/reveal`, {
      purpose: 'session'
    })
    expect(session.json()).toEqual({ value: 'Acme-pass' })
    for (const purpose of ['reveal', 'paste']) {
      const res = await call(bia, 'POST', `/api/v1/secrets/${acme.secret}/reveal`, { purpose })
      expect(res.statusCode).toBe(403)
    }
  })

  it('does not see a parent it was not granted on beyond its name', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'editor')
    const res = await call(bia, 'PATCH', `/api/v1/clients/${acme.client.id}`, { name: 'x' })
    expect(res.statusCode).toBe(403)
  })
})

describe('editor', () => {
  it('manages what is inside the granted project', async () => {
    const acme = await tree('Acme')
    await grant('environment', acme.env.id, 'editor')
    const group = await body(bia, 'POST', '/api/v1/groups', {
      environmentId: acme.env.id,
      name: 'Cache'
    })
    const created = await newConnection(bia, group.id)
    expect(created.statusCode).toBe(201)
    expect(
      (await call(bia, 'PATCH', `/api/v1/connections/${acme.conn.id}`, { name: 'renamed' }))
        .statusCode
    ).toBe(200)
    expect(
      (await call(bia, 'POST', `/api/v1/connections/${acme.conn.id}/duplicate`)).statusCode
    ).toBe(201)
    expect((await call(bia, 'DELETE', `/api/v1/groups/${group.id}`)).statusCode).toBe(204)
  })

  it('reveals and pastes passwords', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'editor')
    for (const purpose of ['session', 'reveal', 'paste']) {
      const res = await call(bia, 'POST', `/api/v1/secrets/${acme.secret}/reveal`, { purpose })
      expect(res.json()).toEqual({ value: 'Acme-pass' })
    }
  })

  it('cannot move a connection to a project it does not edit', async () => {
    const acme = await tree('Acme')
    const other = await tree('Other')
    await grant('group', acme.group.id, 'editor')
    await grant('group', other.group.id, 'viewer')
    const res = await call(bia, 'PATCH', `/api/v1/connections/${acme.conn.id}`, {
      groupId: other.group.id
    })
    expect(res.statusCode).toBe(403)
  })

  it('the strongest grant on the path wins', async () => {
    const acme = await tree('Acme')
    await grant('client', acme.client.id, 'viewer')
    await grant('group', acme.group.id, 'editor')
    expect(
      (await call(bia, 'PATCH', `/api/v1/connections/${acme.conn.id}`, { name: 'x' })).statusCode
    ).toBe(200)
    expect(
      (await call(bia, 'PATCH', `/api/v1/environments/${acme.env.id}`, { name: 'x' })).statusCode
    ).toBe(403)
  })

  it('cannot attach a secret that belongs to another connection', async () => {
    const acme = await tree('Acme')
    const other = await tree('Other')
    await grant('group', acme.group.id, 'editor')
    const stolen = await newConnection(bia, acme.group.id, { credentialRef: other.secret })
    expect(stolen.statusCode).toBe(404)
    const swap = await call(bia, 'PATCH', `/api/v1/connections/${acme.conn.id}`, {
      credentialRef: other.secret
    })
    expect(swap.statusCode).toBe(404)
  })

  it('attaches a secret it just created, and nobody else can touch that loose secret', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'editor')
    const { id } = await body(bia, 'POST', '/api/v1/secrets', { value: 'mine' })
    const cara = (await login(app, 'cara@acme.com')).auth
    await grant('group', acme.group.id, 'editor', (await body(cara, 'GET', '/api/v1/me')).id)
    expect((await call(cara, 'PUT', `/api/v1/secrets/${id}`, { value: 'x' })).statusCode).toBe(404)
    expect((await newConnection(cara, acme.group.id, { credentialRef: id })).statusCode).toBe(404)
    expect((await newConnection(bia, acme.group.id, { credentialRef: id })).statusCode).toBe(201)
  })

  it('cannot store a secret without editing some project', async () => {
    expect((await call(bia, 'POST', '/api/v1/secrets', { value: 'x' })).statusCode).toBe(403)
  })

  it('creates tags but only admins rename or delete them', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'editor')
    const tag = await body(bia, 'POST', '/api/v1/tags', { name: 'db' })
    expect((await call(bia, 'PATCH', `/api/v1/tags/${tag.id}`, { name: 'x' })).statusCode).toBe(403)
    expect((await call(bia, 'DELETE', `/api/v1/tags/${tag.id}`)).statusCode).toBe(403)
    expect(
      (await call(bia, 'PUT', `/api/v1/connections/${acme.conn.id}/tags`, { tagIds: [tag.id] }))
        .statusCode
    ).toBe(200)
  })
})

describe('my access', () => {
  it('tells the desktop the role and grants so it can hide actions', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'viewer')
    expect(await body(bia, 'GET', '/api/v1/me/access')).toEqual({
      role: 'member',
      grants: [{ scopeType: 'group', scopeId: acme.group.id, role: 'viewer' }]
    })
    expect(await body(admin, 'GET', '/api/v1/me/access')).toEqual({ role: 'admin', grants: [] })
  })
})

describe('admin API', () => {
  it('is admin only', async () => {
    for (const [method, url] of [
      ['GET', '/api/v1/admin/users'],
      ['GET', '/api/v1/admin/grants'],
      ['PUT', '/api/v1/admin/grants']
    ] as const) {
      expect((await call(bia, method, url, {})).statusCode).toBe(403)
    }
  })

  it('lists users with their grants', async () => {
    const acme = await tree('Acme')
    await grant('client', acme.client.id, 'editor')
    const users = await body(admin, 'GET', '/api/v1/admin/users')
    expect(users).toEqual([
      expect.objectContaining({ email: 'ana@acme.com', role: 'admin', disabled: false }),
      expect.objectContaining({
        email: 'bia@acme.com',
        role: 'member',
        grants: [{ scopeType: 'client', scopeId: acme.client.id, role: 'editor' }]
      })
    ])
  })

  it('adds a user before their first sign-in', async () => {
    const created = await body(admin, 'POST', '/api/v1/admin/users', { email: 'Davi@Acme.com' })
    expect(created).toMatchObject({ email: 'davi@acme.com', role: 'member' })
    const davi = await login(app, 'davi@acme.com')
    expect((await body(davi.auth, 'GET', '/api/v1/me')).id).toBe(created.id)
    expect(
      (await call(admin, 'POST', '/api/v1/admin/users', { email: 'davi@acme.com' })).statusCode
    ).toBe(409)
  })

  it('changing a grant replaces it; removing it hides the project again', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'viewer')
    await grant('group', acme.group.id, 'editor')
    expect((await body(bia, 'GET', '/api/v1/me/access')).grants).toEqual([
      { scopeType: 'group', scopeId: acme.group.id, role: 'editor' }
    ])
    await body(admin, 'DELETE', '/api/v1/admin/grants', {
      userId: biaId,
      scopeType: 'group',
      scopeId: acme.group.id
    })
    expect(await body(bia, 'GET', '/api/v1/connections')).toEqual([])
  })

  it('shows who has access to a project, including grants above it', async () => {
    const acme = await tree('Acme')
    await grant('client', acme.client.id, 'viewer')
    const list = await body(
      admin,
      'GET',
      `/api/v1/admin/grants?scopeType=group&scopeId=${acme.group.id}`
    )
    expect(list).toEqual([
      expect.objectContaining({
        userId: biaId,
        email: 'bia@acme.com',
        scopeType: 'client',
        scopeId: acme.client.id,
        role: 'viewer'
      })
    ])
  })

  it('rejects a grant on an unknown project or user', async () => {
    const res = await call(admin, 'PUT', '/api/v1/admin/grants', {
      userId: biaId,
      scopeType: 'group',
      scopeId: '3f1c2b9e-1111-4222-8333-444455556666',
      role: 'viewer'
    })
    expect(res.statusCode).toBe(404)
  })

  it('deleting a project drops its grants', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'viewer')
    await body(admin, 'DELETE', `/api/v1/clients/${acme.client.id}`)
    expect((await body(bia, 'GET', '/api/v1/me/access')).grants).toEqual([])
  })

  it('promotes, demotes and disables users, but never the last admin', async () => {
    await body(admin, 'PATCH', `/api/v1/admin/users/${biaId}`, { role: 'admin' })
    expect((await body(bia, 'GET', '/api/v1/me/access')).role).toBe('admin')
    await body(admin, 'PATCH', `/api/v1/admin/users/${biaId}`, { disabled: true })
    expect((await call(bia, 'GET', '/api/v1/me')).statusCode).toBe(401)
    const anaId = (await body(admin, 'GET', '/api/v1/me')).id
    const last = await call(admin, 'PATCH', `/api/v1/admin/users/${anaId}`, { role: 'member' })
    expect(last.statusCode).toBe(409)
    expect(
      (await call(admin, 'PATCH', `/api/v1/admin/users/${anaId}`, { disabled: true })).statusCode
    ).toBe(409)
  })

  it('records every access change in the audit', async () => {
    const acme = await tree('Acme')
    await grant('group', acme.group.id, 'viewer')
    await body(admin, 'PATCH', `/api/v1/admin/users/${biaId}`, { role: 'admin' })
    const actions = (await body(admin, 'GET', '/api/v1/audit')).map(
      (e: { action: string }) => e.action
    )
    expect(actions).toEqual(expect.arrayContaining(['grant.set', 'user.update']))
  })
})
