import { describe, expect, it } from 'vitest'
import { createTestApp, login } from './test-utils'

describe('GET /api/v1/info', () => {
  it('is public and tells the desktop how to sign in', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/info' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      product: 'north-server',
      name: 'Acme Test',
      auth: { modes: ['dev'] }
    })
  })
})

describe('dev login', () => {
  it('returns an access + refresh token pair and the user', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/dev/login',
      payload: { email: 'Ana@Acme.com', name: 'Ana' }
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toEqual(expect.any(String))
    expect(body.refreshToken).toEqual(expect.any(String))
    expect(body.expiresIn).toBe(600)
    expect(body.user).toMatchObject({ email: 'ana@acme.com', name: 'Ana' })
  })

  it('makes the first user admin and later ones members', async () => {
    const { app } = await createTestApp()
    const first = await login(app, 'first@acme.com')
    const second = await login(app, 'second@acme.com')
    const me1 = await app.inject({ method: 'GET', url: '/api/v1/me', headers: first.auth })
    const me2 = await app.inject({ method: 'GET', url: '/api/v1/me', headers: second.auth })
    expect(me1.json().role).toBe('admin')
    expect(me2.json().role).toBe('member')
  })

  it('reuses the same user on a second login', async () => {
    const { app } = await createTestApp()
    const a = await login(app, 'ana@acme.com')
    const b = await login(app, 'ANA@acme.com')
    const meA = await app.inject({ method: 'GET', url: '/api/v1/me', headers: a.auth })
    const meB = await app.inject({ method: 'GET', url: '/api/v1/me', headers: b.auth })
    expect(meA.json().id).toBe(meB.json().id)
  })

  it('rejects an invalid email', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/dev/login',
      payload: { email: 'nope' }
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('validation')
  })

  it('does not exist when dev mode is off', async () => {
    const { app } = await createTestApp({ authModes: ['entra'] })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/dev/login',
      payload: { email: 'ana@acme.com' }
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('authentication guard', () => {
  it('rejects requests without a token', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/clients' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('unauthorized')
  })

  it('rejects a garbage token', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/clients',
      headers: { authorization: 'Bearer nope' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a token of a disabled user right away', async () => {
    const { app, db } = await createTestApp()
    const { auth } = await login(app)
    await db.query(`UPDATE users SET disabled_at = now()`)
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers: auth })
    expect(res.statusCode).toBe(401)
  })
})

describe('refresh', () => {
  it('rotates the pair and the old refresh token stops working', async () => {
    const { app } = await createTestApp()
    const first = await login(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: first.refreshToken }
    })
    expect(res.statusCode).toBe(200)
    const second = res.json()
    expect(second.refreshToken).not.toBe(first.refreshToken)
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${second.accessToken}` }
    })
    expect(me.statusCode).toBe(200)
  })

  it('reusing a rotated token revokes every session of that user', async () => {
    const { app } = await createTestApp()
    const first = await login(app)
    const rotated = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: first.refreshToken }
      })
    ).json()
    const reuse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: first.refreshToken }
    })
    expect(reuse.statusCode).toBe(401)
    const afterTheft = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: rotated.refreshToken }
    })
    expect(afterTheft.statusCode).toBe(401)
  })

  it('rejects an unknown refresh token', async () => {
    const { app } = await createTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'x'.repeat(43) }
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects an expired refresh token', async () => {
    const { app, db } = await createTestApp()
    const { refreshToken } = await login(app)
    await db.query(`UPDATE refresh_tokens SET expires_at = now() - interval '1 minute'`)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken }
    })
    expect(res.statusCode).toBe(401)
  })

  it('refuses to refresh for a disabled user', async () => {
    const { app, db } = await createTestApp()
    const { refreshToken } = await login(app)
    await db.query(`UPDATE users SET disabled_at = now()`)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken }
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('logout', () => {
  it('revokes the refresh token', async () => {
    const { app } = await createTestApp()
    const { refreshToken } = await login(app)
    const out = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken }
    })
    expect(out.statusCode).toBe(204)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken }
    })
    expect(res.statusCode).toBe(401)
  })

  it('is idempotent for unknown tokens', async () => {
    const { app } = await createTestApp()
    const out = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken: 'x'.repeat(43) }
    })
    expect(out.statusCode).toBe(204)
  })
})

describe('refresh tokens at rest', () => {
  it('are stored only as hashes', async () => {
    const { app, db } = await createTestApp()
    const { refreshToken } = await login(app)
    const { rows } = await db.query<{ token_hash: string }>('SELECT token_hash FROM refresh_tokens')
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).not.toBe(refreshToken)
  })
})
