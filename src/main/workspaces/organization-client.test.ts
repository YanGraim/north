import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  memoryTokenStore,
  normalizeServerUrl,
  OrganizationClient,
  OrganizationSignedOutError,
  probeServer
} from './organization-client'
import { startTestServer } from './test-server'

let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  server = await startTestServer()
}, 60_000)

afterAll(async () => {
  await server.stop()
})

describe('normalizeServerUrl', () => {
  it.each([
    ['https://north.acme.com', 'https://north.acme.com'],
    ['https://north.acme.com/', 'https://north.acme.com'],
    ['  https://north.acme.com/base/  ', 'https://north.acme.com/base'],
    ['north.acme.com', 'https://north.acme.com'],
    ['http://localhost:8080', 'http://localhost:8080'],
    ['http://127.0.0.1:8080/', 'http://127.0.0.1:8080']
  ])('%s → %s', (input, expected) => {
    expect(normalizeServerUrl(input)).toBe(expected)
  })

  it('refuses plain http outside loopback (tokens would travel in clear text)', () => {
    expect(() => normalizeServerUrl('http://north.acme.com')).toThrow(/https/i)
  })

  it.each(['', 'ftp://x', 'https://', 'not a url at all'])('refuses %j', (input) => {
    expect(() => normalizeServerUrl(input)).toThrow()
  })
})

describe('probeServer', () => {
  it('reads the organization name and sign-in modes', async () => {
    const info = await probeServer(server.url)
    expect(info).toMatchObject({ name: 'Acme Test', authModes: ['dev'] })
  })

  it('explains when nothing answers', async () => {
    await expect(probeServer('http://127.0.0.1:1')).rejects.toThrow(/não respondeu/i)
  })

  it('explains when the address is not a North Server', async () => {
    await expect(probeServer(`${server.url}/healthz-not-here`)).rejects.toThrow(/North Server/)
  })
})

describe('OrganizationClient', () => {
  it('signs in by e-mail, keeps the refresh token in the store and calls the API', async () => {
    const tokens = memoryTokenStore()
    const client = new OrganizationClient(server.url, tokens)
    const user = await client.devLogin('ana@acme.com', 'Ana')
    expect(user.email).toBe('ana@acme.com')
    expect(tokens.get()).toEqual(expect.any(String))
    const me = await client.request<{ email: string }>('GET', '/api/v1/me')
    expect(me.email).toBe('ana@acme.com')
  })

  it('renews an expired access token once and retries transparently', async () => {
    const tokens = memoryTokenStore()
    const client = new OrganizationClient(server.url, tokens)
    await client.devLogin('bia@acme.com')
    const before = tokens.get()
    client.forgetAccessToken('garbage')
    const me = await client.request<{ email: string }>('GET', '/api/v1/me')
    expect(me.email).toBe('bia@acme.com')
    expect(tokens.get()).not.toBe(before)
  })

  it('signs in from a stored refresh token after a restart (no access token in memory)', async () => {
    const tokens = memoryTokenStore()
    await new OrganizationClient(server.url, tokens).devLogin('carla@acme.com')
    const restarted = new OrganizationClient(server.url, tokens)
    const me = await restarted.request<{ email: string }>('GET', '/api/v1/me')
    expect(me.email).toBe('carla@acme.com')
  })

  it('reports signed-out and clears the store when the user is disabled', async () => {
    const tokens = memoryTokenStore()
    const client = new OrganizationClient(server.url, tokens)
    await client.devLogin('dani@acme.com')
    await server.db.query(`UPDATE users SET disabled_at = now() WHERE email = 'dani@acme.com'`)
    await expect(client.request('GET', '/api/v1/me')).rejects.toBeInstanceOf(
      OrganizationSignedOutError
    )
    expect(tokens.get()).toBeNull()
  })

  it('reports signed-out with nothing stored', async () => {
    const client = new OrganizationClient(server.url, memoryTokenStore())
    await expect(client.request('GET', '/api/v1/me')).rejects.toBeInstanceOf(
      OrganizationSignedOutError
    )
  })

  it('surfaces the server error message', async () => {
    const client = new OrganizationClient(server.url, memoryTokenStore())
    await client.devLogin('edu@acme.com')
    await expect(client.request('POST', '/api/v1/clients', { name: '' })).rejects.toThrow(/name/)
  })

  it('returns undefined for 204 responses', async () => {
    const client = new OrganizationClient(server.url, memoryTokenStore())
    await client.devLogin('fabi@acme.com')
    const created = await client.request<{ id: string }>('POST', '/api/v1/clients', { name: 'X' })
    expect(await client.request('DELETE', `/api/v1/clients/${created.id}`)).toBeUndefined()
  })

  it('logout revokes the session on the server and clears the store', async () => {
    const tokens = memoryTokenStore()
    const client = new OrganizationClient(server.url, tokens)
    await client.devLogin('gil@acme.com')
    const refresh = tokens.get()
    await client.logout()
    expect(tokens.get()).toBeNull()
    const res = await fetch(`${server.url}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh })
    })
    expect(res.status).toBe(401)
  })
})
