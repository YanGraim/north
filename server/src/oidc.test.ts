import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { OidcConfig } from './config'
import type { Db } from './db'
import { type FakeOidcProvider, type FakeUser, startFakeOidc } from './dev/fake-oidc'
import { createUser } from './store/users'
import { createTestApp, login } from './test-utils'

const NONCE = 'nonce-0123456789abcdef'

let idp: FakeOidcProvider
beforeAll(async () => {
  idp = await startFakeOidc()
})
afterAll(() => idp.close())

async function setup(
  oidc: Partial<OidcConfig> = {},
  modes: ('dev' | 'entra')[] = ['entra']
): Promise<{ app: FastifyInstance; db: Db }> {
  return createTestApp({
    authModes: modes,
    oidc: {
      issuer: idp.issuer,
      clientId: idp.clientId,
      tenantId: idp.tenantId,
      adminGroups: [],
      allowNewUsers: true,
      ...oidc
    }
  })
}

async function entraLogin(
  app: FastifyInstance,
  user: FakeUser,
  overrides: Record<string, unknown> = {},
  nonce = NONCE
) {
  const idToken = await idp.idToken(user, { nonce: NONCE, ...overrides })
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/oidc/login',
    payload: { idToken, nonce }
  })
}

const me = async (app: FastifyInstance, accessToken: string) =>
  (
    await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${accessToken}` }
    })
  ).json()

describe('GET /api/v1/info with Entra', () => {
  it('tells clients where to sign in', async () => {
    const { app } = await setup()
    const res = await app.inject({ method: 'GET', url: '/api/v1/info' })
    expect(res.json().auth).toEqual({
      modes: ['entra'],
      oidc: {
        issuer: idp.issuer,
        clientId: idp.clientId,
        scopes: ['openid', 'profile', 'email'],
        authorizationEndpoint: expect.stringMatching(/\/oauth2\/v2\.0\/authorize$/),
        tokenEndpoint: expect.stringMatching(/\/oauth2\/v2\.0\/token$/)
      }
    })
  })

  it('has no oidc block in dev-only mode', async () => {
    const res = await (await createTestApp()).app.inject({ method: 'GET', url: '/api/v1/info' })
    expect(res.json().auth.oidc).toBeNull()
  })

  it('still answers when the provider is unreachable', async () => {
    const { app } = await setup({ issuer: 'http://127.0.0.1:1/nope/v2.0' })
    const res = await app.inject({ method: 'GET', url: '/api/v1/info' })
    expect(res.statusCode).toBe(200)
    expect(res.json().auth.oidc).toMatchObject({ authorizationEndpoint: null })
  })
})

describe('POST /api/v1/auth/oidc/login', () => {
  it('opens a North session for a valid Entra token', async () => {
    const { app } = await setup()
    const res = await entraLogin(app, { email: 'Ana@Acme.com', name: 'Ana Souza' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user).toMatchObject({ email: 'ana@acme.com', name: 'Ana Souza', role: 'admin' })
    expect(await me(app, body.accessToken)).toMatchObject({ email: 'ana@acme.com' })
  })

  it('refreshes like any other session', async () => {
    const { app } = await setup()
    const { refreshToken } = (await entraLogin(app, { email: 'ana@acme.com' })).json()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken }
    })
    expect(res.statusCode).toBe(200)
  })

  it('makes the first person admin and later ones members with no projects', async () => {
    const { app } = await setup()
    await entraLogin(app, { email: 'first@acme.com' })
    const second = (await entraLogin(app, { email: 'second@acme.com' })).json()
    expect(second.user.role).toBe('member')
    const clients = await app.inject({
      method: 'GET',
      url: '/api/v1/clients',
      headers: { authorization: `Bearer ${second.accessToken}` }
    })
    expect(clients.json()).toEqual([])
  })

  it('keeps the same person when their e-mail changes in Entra', async () => {
    const { app } = await setup()
    const a = (await entraLogin(app, { email: 'ana@acme.com', oid: 'oid-ana' })).json()
    const b = (await entraLogin(app, { email: 'ana.souza@acme.com', oid: 'oid-ana' })).json()
    expect(b.user.id).toBe(a.user.id)
    expect(b.user.email).toBe('ana.souza@acme.com')
  })

  it('links to a person the admin added before their first sign-in', async () => {
    const { app, db } = await setup()
    await entraLogin(app, { email: 'admin@acme.com' })
    const added = await createUser(db, 'bia@acme.com', 'Bia')
    const res = (await entraLogin(app, { email: 'bia@acme.com' })).json()
    expect(res.user.id).toBe(added.id)
  })

  it('links an account that used the dev sign-in', async () => {
    const { app } = await setup({}, ['dev', 'entra'])
    const dev = await login(app, 'carl@acme.com')
    const devMe = await me(app, dev.accessToken)
    const res = (await entraLogin(app, { email: 'carl@acme.com' })).json()
    expect(res.user.id).toBe(devMe.id)
  })

  it('refuses an e-mail already linked to another Entra account', async () => {
    const { app } = await setup()
    await entraLogin(app, { email: 'shared@acme.com', oid: 'oid-1' })
    const res = await entraLogin(app, { email: 'shared@acme.com', oid: 'oid-2' })
    expect(res.statusCode).toBe(409)
  })

  it('refuses a disabled person', async () => {
    const { app } = await setup()
    const admin = (await entraLogin(app, { email: 'admin@acme.com' })).json()
    const bob = (await entraLogin(app, { email: 'bob@acme.com' })).json()
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${bob.user.id}`,
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { disabled: true }
    })
    expect((await entraLogin(app, { email: 'bob@acme.com' })).statusCode).toBe(401)
  })

  it('invite-only: refuses people nobody added', async () => {
    const { app, db } = await setup({ allowNewUsers: false })
    await entraLogin(app, { email: 'admin@acme.com' })
    const stranger = await entraLogin(app, { email: 'stranger@acme.com' })
    expect(stranger.statusCode).toBe(403)
    expect(stranger.json().error.message).toMatch(/Ask an admin/)
    await createUser(db, 'invited@acme.com', '')
    expect((await entraLogin(app, { email: 'invited@acme.com' })).statusCode).toBe(200)
  })

  it('invite-only still lets the very first person in, as admin', async () => {
    const { app } = await setup({ allowNewUsers: false })
    const res = await entraLogin(app, { email: 'first@acme.com' })
    expect(res.json().user.role).toBe('admin')
  })

  describe('rejects tokens it should not trust', () => {
    it('from another tenant', async () => {
      const { app } = await setup()
      const res = await entraLogin(app, { email: 'x@evil.com' }, { tid: 'other-tenant' })
      expect(res.statusCode).toBe(401)
      expect(res.json().error.message).toMatch(/another organization/)
    })

    it('for another app (audience)', async () => {
      const { app } = await setup()
      const res = await entraLogin(app, { email: 'x@acme.com' }, { aud: 'some-other-app' })
      expect(res.statusCode).toBe(401)
    })

    it('with a different nonce (replayed sign-in)', async () => {
      const { app } = await setup()
      const res = await entraLogin(app, { email: 'x@acme.com' }, {}, 'nonce-another-one-9999')
      expect(res.statusCode).toBe(401)
    })

    it('with a forged signature', async () => {
      const { app } = await setup()
      const token = await idp.idToken({ email: 'x@acme.com' }, { nonce: NONCE })
      const [h, p] = token.split('.')
      const forged = `${h}.${Buffer.from(
        JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), oid: 'admin' })
      ).toString('base64url')}.${token.split('.')[2]}`
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/oidc/login',
        payload: { idToken: forged, nonce: NONCE }
      })
      expect(res.statusCode).toBe(401)
    })

    it('signed by a different provider', async () => {
      const other = await startFakeOidc({ tenantId: idp.tenantId })
      try {
        const { app } = await setup()
        const token = await other.idToken({ email: 'x@acme.com' }, { nonce: NONCE })
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/oidc/login',
          payload: { idToken: token, nonce: NONCE }
        })
        expect(res.statusCode).toBe(401)
      } finally {
        await other.close()
      }
    })

    it('expired', async () => {
      const { app } = await setup()
      const past = Math.floor(Date.now() / 1000) - 7200
      const res = await entraLogin(app, { email: 'x@acme.com' }, { exp: past, iat: past - 60 })
      expect(res.statusCode).toBe(401)
    })

    it('without an e-mail', async () => {
      const { app } = await setup()
      const res = await entraLogin(app, { email: 'x@acme.com' }, { preferred_username: 'nobody' })
      expect(res.statusCode).toBe(401)
    })
  })

  it('is not exposed when Entra is off', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oidc/login',
      payload: { idToken: 'x', nonce: NONCE }
    })
    expect(res.statusCode).toBe(404)
  })

  it('validates the body', async () => {
    const { app } = await setup()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oidc/login',
      payload: { idToken: '' }
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('Entra groups → admin', () => {
  const ADMINS = 'grp-north-admins'

  it('people in the admin group become admins; others members', async () => {
    const { app } = await setup({ adminGroups: [ADMINS] })
    const first = (await entraLogin(app, { email: 'plain@acme.com', groups: ['grp-x'] })).json()
    expect(first.user.role).toBe('member')
    const boss = (await entraLogin(app, { email: 'boss@acme.com', groups: [ADMINS] })).json()
    expect(boss.user.role).toBe('admin')
  })

  it('leaving the group demotes on the next sign-in, but never the last admin', async () => {
    const { app } = await setup({ adminGroups: [ADMINS] })
    await entraLogin(app, { email: 'a@acme.com', oid: 'oa', groups: [ADMINS] })
    await entraLogin(app, { email: 'b@acme.com', oid: 'ob', groups: [ADMINS] })
    const a = (await entraLogin(app, { email: 'a@acme.com', oid: 'oa', groups: [] })).json()
    expect(a.user.role).toBe('member')
    const b = (await entraLogin(app, { email: 'b@acme.com', oid: 'ob', groups: [] })).json()
    expect(b.user.role).toBe('admin')
  })

  it('a token without the groups claim keeps the current role', async () => {
    const { app } = await setup({ adminGroups: [ADMINS] })
    await entraLogin(app, { email: 'a@acme.com', oid: 'oa', groups: [ADMINS] })
    const again = (await entraLogin(app, { email: 'a@acme.com', oid: 'oa' })).json()
    expect(again.user.role).toBe('admin')
  })

  it('without admin groups configured, roles stay with the panel', async () => {
    const { app } = await setup()
    await entraLogin(app, { email: 'first@acme.com' })
    const res = (await entraLogin(app, { email: 'g@acme.com', groups: ['anything'] })).json()
    expect(res.user.role).toBe('member')
  })
})

describe('admin panel CSP', () => {
  it('lets the panel redeem the code at the identity provider, nothing else', async () => {
    const { app } = await setup()
    const res = await app.inject({ method: 'GET', url: '/admin' })
    const csp = String(res.headers['content-security-policy'])
    expect(csp).toContain(`connect-src 'self' ${new URL(idp.issuer).origin};`)
    expect(csp).toContain("script-src 'self';")
  })
})
