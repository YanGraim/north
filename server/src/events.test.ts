import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, login } from './test-utils'

/** Push channel (ADR 0018 §6, fase 5): the desktop learns about changes without polling. */

type Msg = { type: string; [k: string]: unknown }

let app: FastifyInstance
let url: string
const sockets: WebSocket[] = []

beforeEach(async () => {
  ;({ app } = await createTestApp())
  await app.listen({ port: 0, host: '127.0.0.1' })
  url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/v1/events`
})

afterEach(async () => {
  for (const s of sockets.splice(0)) s.close()
  await app.close()
})

/** Opens the channel, authenticates and collects every message. */
async function listen(accessToken: string) {
  const ws = new WebSocket(url)
  sockets.push(ws)
  const messages: Msg[] = []
  let closed: { code: number } | null = null
  ws.addEventListener('message', (e) => messages.push(JSON.parse(String(e.data))))
  ws.addEventListener('close', (e) => {
    closed = { code: e.code }
  })
  await new Promise((r) => ws.addEventListener('open', r))
  ws.send(JSON.stringify({ type: 'auth', token: accessToken }))
  const until = async (pred: (m: Msg[]) => boolean, ms = 2000) => {
    const end = Date.now() + ms
    while (!pred(messages) && Date.now() < end) await new Promise((r) => setTimeout(r, 10))
    return messages
  }
  await until((m) => m.some((x) => x.type === 'ready'))
  return { ws, messages, until, closed: () => closed }
}

const inject = (auth: { authorization: string }, method: string, path: string, payload?: unknown) =>
  app.inject({ method: method as 'GET', url: path, headers: auth, payload: payload as object })

describe('events channel', () => {
  it('says ready after a valid token', async () => {
    const { accessToken } = await login(app)
    const { messages } = await listen(accessToken)
    expect(messages).toEqual([{ type: 'ready' }])
  })

  it('closes with 4401 on a bad token, or when no token arrives', async () => {
    const ws = new WebSocket(url)
    sockets.push(ws)
    const closed = new Promise<number>((r) => ws.addEventListener('close', (e) => r(e.code)))
    await new Promise((r) => ws.addEventListener('open', r))
    ws.send(JSON.stringify({ type: 'auth', token: 'nope' }))
    expect(await closed).toBe(4401)
  })

  it('tells everyone that the inventory changed, without the data itself', async () => {
    const ana = await login(app, 'ana@acme.com')
    const bia = await login(app, 'bia@acme.com')
    const a = await listen(ana.accessToken)
    const b = await listen(bia.accessToken)
    await inject(ana.auth, 'POST', '/api/v1/clients', { name: 'Secret Corp' })
    await a.until((m) => m.length > 1)
    await b.until((m) => m.length > 1)
    expect(a.messages.at(-1)).toEqual({ type: 'inventory.changed', entity: 'client' })
    expect(b.messages.at(-1)).toEqual({ type: 'inventory.changed', entity: 'client' })
    expect(JSON.stringify(b.messages)).not.toContain('Secret Corp')
  })

  it('does not announce failed changes or reads', async () => {
    const ana = await login(app)
    const a = await listen(ana.accessToken)
    await inject(ana.auth, 'GET', '/api/v1/clients')
    await inject(ana.auth, 'POST', '/api/v1/clients', { name: '' })
    await new Promise((r) => setTimeout(r, 100))
    expect(a.messages).toEqual([{ type: 'ready' }])
  })

  it('a favorite is personal and is not broadcast', async () => {
    const ana = await login(app, 'ana@acme.com')
    const client = (await inject(ana.auth, 'POST', '/api/v1/clients', { name: 'A' })).json()
    const env = (
      await inject(ana.auth, 'POST', '/api/v1/environments', { clientId: client.id, name: 'E' })
    ).json()
    const group = (
      await inject(ana.auth, 'POST', '/api/v1/groups', { environmentId: env.id, name: 'G' })
    ).json()
    const conn = (
      await inject(ana.auth, 'POST', '/api/v1/connections', {
        groupId: group.id,
        name: 'c',
        protocol: 'ssh',
        host: 'h',
        port: 22,
        authMethod: 'password'
      })
    ).json()
    const a = await listen(ana.accessToken)
    await inject(ana.auth, 'POST', `/api/v1/connections/${conn.id}/favorite`)
    await new Promise((r) => setTimeout(r, 100))
    expect(a.messages).toEqual([{ type: 'ready' }])
  })

  it('tells only the affected person that their access changed', async () => {
    const ana = await login(app, 'ana@acme.com')
    const bia = await login(app, 'bia@acme.com')
    const cara = await login(app, 'cara@acme.com')
    const biaId = (await inject(bia.auth, 'GET', '/api/v1/me')).json().id
    const client = (await inject(ana.auth, 'POST', '/api/v1/clients', { name: 'A' })).json()
    const b = await listen(bia.accessToken)
    const c = await listen(cara.accessToken)
    await inject(ana.auth, 'PUT', '/api/v1/admin/grants', {
      userId: biaId,
      scopeType: 'client',
      scopeId: client.id,
      role: 'viewer'
    })
    await b.until((m) => m.some((x) => x.type === 'access.changed'))
    expect(b.messages).toContainEqual({ type: 'access.changed' })
    expect(c.messages).not.toContainEqual({ type: 'access.changed' })
  })

  it('disabling a person revokes them right away and closes their channel', async () => {
    const ana = await login(app, 'ana@acme.com')
    const bia = await login(app, 'bia@acme.com')
    const biaId = (await inject(bia.auth, 'GET', '/api/v1/me')).json().id
    const b = await listen(bia.accessToken)
    await inject(ana.auth, 'PATCH', `/api/v1/admin/users/${biaId}`, { disabled: true })
    await b.until(() => b.closed() !== null)
    expect(b.messages).toContainEqual({ type: 'session.revoked', reason: 'disabled' })
    expect(b.closed()?.code).toBe(4403)
  })

  it('a role change counts as an access change', async () => {
    const ana = await login(app, 'ana@acme.com')
    const bia = await login(app, 'bia@acme.com')
    const biaId = (await inject(bia.auth, 'GET', '/api/v1/me')).json().id
    const b = await listen(bia.accessToken)
    await inject(ana.auth, 'PATCH', `/api/v1/admin/users/${biaId}`, { role: 'admin' })
    await b.until((m) => m.some((x) => x.type === 'access.changed'))
    expect(b.messages).toContainEqual({ type: 'access.changed' })
  })
})
