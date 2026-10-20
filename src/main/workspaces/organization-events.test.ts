import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { memoryTokenStore, OrganizationClient } from './organization-client'
import { type OrganizationEventHandlers, OrganizationEvents } from './organization-events'
import { startTestServer } from './test-server'

let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  server = await startTestServer()
}, 60_000)

afterAll(async () => {
  await server.stop()
})

async function signedIn(email: string) {
  const client = new OrganizationClient(server.url, memoryTokenStore())
  const user = await client.devLogin(email)
  return { client, user }
}

function recorder() {
  const log: string[] = []
  const handlers: OrganizationEventHandlers = {
    onInventoryChanged: (entity) => log.push(`inventory:${entity}`),
    onAccessChanged: () => log.push('access'),
    onRevoked: () => log.push('revoked'),
    onSignedOut: () => log.push('signed-out')
  }
  const until = async (pred: () => boolean, ms = 3000) => {
    const end = Date.now() + ms
    while (!pred() && Date.now() < end) await new Promise((r) => setTimeout(r, 10))
  }
  return { log, handlers, until }
}

describe('OrganizationEvents', () => {
  it('connects with the session token and relays inventory changes', async () => {
    const { client } = await signedIn('ana@acme.com')
    await server.makeAdmin('ana@acme.com')
    const { log, handlers, until } = recorder()
    const events = new OrganizationEvents(client, handlers)
    await events.start()
    await client.request('POST', '/api/v1/clients', { name: 'Live' })
    await until(() => log.includes('inventory:client'))
    events.stop()
    expect(log).toContain('inventory:client')
  })

  it('relays an access change for this user', async () => {
    const admin = await signedIn('ana@acme.com')
    const { client, user } = await signedIn('lia@acme.com')
    const target = await admin.client.request<{ id: string }>('POST', '/api/v1/clients', {
      name: 'P'
    })
    const { log, handlers, until } = recorder()
    const events = new OrganizationEvents(client, handlers)
    await events.start()
    await admin.client.request('PUT', '/api/v1/admin/grants', {
      userId: user.id,
      scopeType: 'client',
      scopeId: target.id,
      role: 'viewer'
    })
    await until(() => log.includes('access'))
    events.stop()
    expect(log).toContain('access')
  })

  it('reports a revocation and does not reconnect', async () => {
    const admin = await signedIn('ana@acme.com')
    const { client, user } = await signedIn('ivo@acme.com')
    const { log, handlers, until } = recorder()
    const events = new OrganizationEvents(client, handlers, { retryMs: 20 })
    await events.start()
    await admin.client.request('PATCH', `/api/v1/admin/users/${user.id}`, { disabled: true })
    await until(() => log.includes('revoked'))
    await new Promise((r) => setTimeout(r, 150))
    expect(log.filter((e) => e === 'revoked')).toHaveLength(1)
    expect(events.connected).toBe(false)
  })

  it('reconnects after the server drops the channel', async () => {
    const { client } = await signedIn('rui@acme.com')
    await server.makeAdmin('rui@acme.com')
    const { log, handlers, until } = recorder()
    const events = new OrganizationEvents(client, handlers, { retryMs: 20 })
    await events.start()
    events.dropForTest()
    await until(() => events.connected === false)
    await until(() => events.connected)
    await client.request('POST', '/api/v1/clients', { name: 'Again' })
    await until(() => log.includes('inventory:client'))
    events.stop()
    expect(log).toContain('inventory:client')
  })

  it('a stale token gets refreshed instead of signing out', async () => {
    const { client } = await signedIn('gil@acme.com')
    await server.makeAdmin('gil@acme.com')
    client.forgetAccessToken('stale.token.value')
    const { log, handlers, until } = recorder()
    const events = new OrganizationEvents(client, handlers, { retryMs: 20 })
    await events.start()
    await until(() => events.connected)
    events.stop()
    expect(events.connected).toBe(false)
    expect(log).not.toContain('signed-out')
  })
})
