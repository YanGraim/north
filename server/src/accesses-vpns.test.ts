import type { FastifyInstance } from 'fastify'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, login } from './test-utils'

/**
 * REC-023: accesses (database, web login) and shared VPN templates follow the
 * same per-project grants as connections.
 */

type Headers = { authorization: string }
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

let app: FastifyInstance
let admin: Headers
let bia: Headers
let biaId: string

const call = (headers: Headers, method: Method, url: string, payload?: unknown) =>
  app.inject({ method, url, headers, payload: payload as object })

const body = async (headers: Headers, method: Method, url: string, payload?: unknown) => {
  const res = await call(headers, method, url, payload)
  if (res.statusCode >= 300) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body}`)
  return res.statusCode === 204 ? null : res.json()
}

const FORTI = {
  kind: 'fortinet-sslvpn',
  gateway: 'vpn.acme.com',
  port: 10443,
  username: 'ana.admin',
  realm: 'staff'
}

async function tree() {
  const client = await body(admin, 'POST', '/api/v1/clients', { name: 'Acme' })
  const env = await body(admin, 'POST', '/api/v1/environments', {
    clientId: client.id,
    name: 'Prod'
  })
  const group = await body(admin, 'POST', '/api/v1/groups', { environmentId: env.id, name: 'Db' })
  const secret = await body(admin, 'POST', '/api/v1/secrets', { value: 'db-pass' })
  const db = await body(admin, 'POST', '/api/v1/accesses', {
    groupId: group.id,
    type: 'database',
    name: 'pg-prod',
    engine: 'postgres',
    host: '10.0.0.5',
    port: 5432,
    database: 'app',
    username: 'app',
    credentialRef: secret.id
  })
  const portal = await body(admin, 'POST', '/api/v1/accesses', {
    groupId: group.id,
    type: 'login',
    name: 'Portal',
    url: 'https://portal.acme.com'
  })
  return { client, env, group, db, portal, secret: secret.id as string }
}

const grant = (scopeType: string, scopeId: string, role: string) =>
  body(admin, 'PUT', '/api/v1/admin/grants', { userId: biaId, scopeType, scopeId, role })

beforeEach(async () => {
  ;({ app } = await createTestApp())
  ;({ auth: admin } = await login(app, 'ana@acme.com'))
  const member = await login(app, 'bia@acme.com')
  bia = member.auth
  biaId = (await body(bia, 'GET', '/api/v1/me')).id
})

describe('accesses', () => {
  it('keeps database and login accesses, and refuses API collections', async () => {
    const { group, db, portal } = await tree()
    expect(db).toMatchObject({
      type: 'database',
      engine: 'postgres',
      port: 5432,
      isFavorite: false
    })
    expect(portal).toMatchObject({ type: 'login', url: 'https://portal.acme.com' })
    const api = await call(admin, 'POST', '/api/v1/accesses', {
      groupId: group.id,
      type: 'api',
      name: 'Billing API'
    })
    expect(api.statusCode).toBe(400)
    const list = await body(admin, 'GET', `/api/v1/accesses?groupId=${group.id}`)
    expect(list.map((a: { name: string }) => a.name)).toEqual(['pg-prod', 'Portal'])
    expect(await body(admin, 'GET', '/api/v1/accesses?type=login')).toHaveLength(1)
  })

  it('is invisible without a grant and follows the group grant', async () => {
    const { group, db } = await tree()
    expect(await body(bia, 'GET', '/api/v1/accesses')).toEqual([])
    expect((await call(bia, 'GET', `/api/v1/accesses/${db.id}`)).statusCode).toBe(404)
    await grant('group', group.id, 'viewer')
    expect(await body(bia, 'GET', '/api/v1/accesses')).toHaveLength(2)
    expect((await call(bia, 'PATCH', `/api/v1/accesses/${db.id}`, { name: 'x' })).statusCode).toBe(
      403
    )
  })

  it('can be granted alone: one database, nothing else', async () => {
    const { db, client } = await tree()
    await grant('access', db.id, 'viewer')
    const list = await body(bia, 'GET', '/api/v1/accesses')
    expect(list.map((a: { id: string }) => a.id)).toEqual([db.id])
    // The parents show up read-only so the tree can reach it.
    expect((await body(bia, 'GET', '/api/v1/clients')).map((c: { id: string }) => c.id)).toEqual([
      client.id
    ])
    expect(await body(bia, 'GET', '/api/v1/me/access')).toMatchObject({
      accessGrants: [{ accessId: db.id, role: 'viewer' }]
    })
  })

  it('lets a viewer connect with the password but not read it', async () => {
    const { db, secret } = await tree()
    await grant('access', db.id, 'viewer')
    const session = await body(bia, 'POST', `/api/v1/secrets/${secret}/reveal`, {
      purpose: 'session'
    })
    expect(session).toEqual({ value: 'db-pass' })
    const reveal = await call(bia, 'POST', `/api/v1/secrets/${secret}/reveal`, {
      purpose: 'reveal'
    })
    expect(reveal.statusCode).toBe(403)
    await grant('access', db.id, 'editor')
    expect(
      await body(bia, 'POST', `/api/v1/secrets/${secret}/reveal`, { purpose: 'reveal' })
    ).toEqual({ value: 'db-pass' })
    const audit = await body(admin, 'GET', '/api/v1/audit')
    expect(audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'secret.read',
          targetType: 'access',
          targetName: 'pg-prod'
        })
      ])
    )
  })

  it('drops its password with it', async () => {
    const { db, secret } = await tree()
    await body(admin, 'DELETE', `/api/v1/accesses/${db.id}`)
    expect((await call(admin, 'GET', `/api/v1/secrets/${secret}`)).statusCode).toBe(404)
  })

  it('keeps favorites personal and tags shared', async () => {
    const { group, db } = await tree()
    await grant('group', group.id, 'editor')
    const fav = await body(bia, 'POST', `/api/v1/accesses/${db.id}/favorite`)
    expect(fav.isFavorite).toBe(true)
    expect((await body(admin, 'GET', `/api/v1/accesses/${db.id}`)).isFavorite).toBe(false)
    const tag = await body(admin, 'POST', '/api/v1/tags', { name: 'prod' })
    await body(bia, 'PUT', `/api/v1/accesses/${db.id}/tags`, { tagIds: [tag.id] })
    expect(await body(admin, 'GET', `/api/v1/accesses?tagId=${tag.id}`)).toHaveLength(1)
  })
})

describe('VPN templates', () => {
  it('stores the gateway but never a username', async () => {
    const vpn = await body(admin, 'POST', '/api/v1/vpns', { name: 'Acme VPN', config: FORTI })
    expect(vpn.config).toMatchObject({ gateway: 'vpn.acme.com', port: 10443, realm: 'staff' })
    expect(vpn.config.username).toBe('')
  })

  it('keeps only the address of an OpenVPN, never its certificate or key', async () => {
    const vpn = await body(admin, 'POST', '/api/v1/vpns', {
      name: 'ovpn',
      config: {
        kind: 'openvpn',
        ovpn: 'client\nremote vpn.acme.com 1194 udp\n<cert>\nMINE\n</cert>\n<key>\nSECRET\n</key>',
        requiresUserPass: true,
        requiresKeyPassphrase: true,
        username: 'ana',
        remoteSummary: [{ host: 'vpn.acme.com', port: 1194, proto: 'udp' }],
        redirectGateway: false,
        declaredRoutes: []
      }
    })
    expect(vpn.config.ovpn).toBe('client\nremote vpn.acme.com 1194 udp')
    expect(vpn.config).toMatchObject({ username: '', requiresKeyPassphrase: false })
    const empty = await call(admin, 'POST', '/api/v1/vpns', {
      name: 'none',
      config: { ...vpn.config, remoteSummary: [] }
    })
    expect(empty.statusCode).toBe(400)
  })

  it('links to clients, environments, connections and accesses', async () => {
    const { client, env, db } = await tree()
    const vpn = await body(admin, 'POST', '/api/v1/vpns', { name: 'Acme VPN', config: FORTI })
    expect(
      (await body(admin, 'PATCH', `/api/v1/clients/${client.id}`, { vpnId: vpn.id })).vpnId
    ).toBe(vpn.id)
    expect(
      (await body(admin, 'PATCH', `/api/v1/environments/${env.id}`, { vpnId: vpn.id })).vpnId
    ).toBe(vpn.id)
    const patched = await body(admin, 'PATCH', `/api/v1/accesses/${db.id}`, {
      vpnMode: 'profile',
      vpnProfileId: vpn.id
    })
    expect(patched.vpnProfileId).toBe(vpn.id)
    // Removing the VPN unlinks everything instead of failing.
    await body(admin, 'DELETE', `/api/v1/vpns/${vpn.id}`)
    expect((await body(admin, 'GET', `/api/v1/clients/${client.id}`)).vpnId).toBeNull()
    expect((await body(admin, 'GET', `/api/v1/accesses/${db.id}`)).vpnProfileId).toBeNull()
  })

  it('shows a member only the VPNs of what they can see', async () => {
    const { client, db } = await tree()
    const used = await body(admin, 'POST', '/api/v1/vpns', { name: 'Used', config: FORTI })
    await body(admin, 'POST', '/api/v1/vpns', { name: 'Other', config: FORTI })
    await body(admin, 'PATCH', `/api/v1/clients/${client.id}`, { vpnId: used.id })
    expect(await body(bia, 'GET', '/api/v1/vpns')).toEqual([])
    await grant('access', db.id, 'viewer')
    expect((await body(bia, 'GET', '/api/v1/vpns')).map((v: { name: string }) => v.name)).toEqual([
      'Used'
    ])
  })

  it('lets editors publish one, and only admins change or remove it', async () => {
    const { group } = await tree()
    expect((await call(bia, 'POST', '/api/v1/vpns', { name: 'x', config: FORTI })).statusCode).toBe(
      403
    )
    await grant('group', group.id, 'editor')
    const vpn = await body(bia, 'POST', '/api/v1/vpns', { name: 'Bia VPN', config: FORTI })
    expect((await call(bia, 'PATCH', `/api/v1/vpns/${vpn.id}`, { name: 'y' })).statusCode).toBe(403)
    expect((await call(bia, 'DELETE', `/api/v1/vpns/${vpn.id}`)).statusCode).toBe(403)
    expect((await body(admin, 'PATCH', `/api/v1/vpns/${vpn.id}`, { name: 'y' })).name).toBe('y')
  })
})
