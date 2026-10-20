import { ConnectionSchema } from '@shared/types'
import type { FastifyInstance } from 'fastify'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from './db'
import { createTestApp, login } from './test-utils'

let app: FastifyInstance
let db: Db
let auth: { authorization: string }

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  payload?: unknown,
  headers = auth
) {
  return app.inject({ method, url, headers, payload: payload as object })
}

async function seedGroup(): Promise<string> {
  const client = (await call('POST', '/api/v1/clients', { name: 'Acme' })).json()
  const env = (
    await call('POST', '/api/v1/environments', { clientId: client.id, name: 'Prod' })
  ).json()
  return (await call('POST', '/api/v1/groups', { environmentId: env.id, name: 'Web' })).json().id
}

async function newSecret(value = 'hunter2'): Promise<string> {
  const res = await call('POST', '/api/v1/secrets', { value })
  expect(res.statusCode).toBe(201)
  return res.json().id
}

async function newConnection(credentialRef: string | null) {
  const groupId = await seedGroup()
  const res = await call('POST', '/api/v1/connections', {
    groupId,
    name: 'web-01',
    protocol: 'ssh',
    host: '10.0.0.1',
    port: 22,
    authMethod: 'password',
    username: 'root',
    credentialRef
  })
  expect(res.statusCode).toBe(201)
  return ConnectionSchema.parse(res.json())
}

const reveal = (id: string, purpose = 'session') =>
  call('POST', `/api/v1/secrets/${id}/reveal`, { purpose })

beforeEach(async () => {
  ;({ app, db } = await createTestApp())
  ;({ auth } = await login(app))
})

describe('secrets', () => {
  it('stores a secret encrypted and only answers with its id', async () => {
    const res = await call('POST', '/api/v1/secrets', { value: 'hunter2' })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ id: expect.any(String) })
    expect(res.body).not.toContain('hunter2')
    const { rows } = await db.query('SELECT * FROM secrets')
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(rows[0])).not.toContain('hunter2')
  })

  it('says whether a secret exists', async () => {
    const id = await newSecret()
    expect((await call('GET', `/api/v1/secrets/${id}`)).json()).toEqual({ id })
    expect(
      (await call('GET', '/api/v1/secrets/00000000-0000-4000-8000-000000000000')).statusCode
    ).toBe(404)
  })

  it('rejects an empty secret', async () => {
    expect((await call('POST', '/api/v1/secrets', { value: '' })).statusCode).toBe(400)
  })

  it('attaches the secret to a connection through credentialRef', async () => {
    const id = await newSecret()
    const conn = await newConnection(id)
    expect(conn.credentialRef).toBe(id)
    const listed = (await call('GET', '/api/v1/connections')).json()
    expect(listed[0].credentialRef).toBe(id)
    expect(JSON.stringify(listed)).not.toContain('hunter2')
  })

  it('refuses a credentialRef that is not a secret on this server', async () => {
    const groupId = await seedGroup()
    const res = await call('POST', '/api/v1/connections', {
      groupId,
      name: 'x',
      protocol: 'ssh',
      host: 'h',
      port: 22,
      authMethod: 'password',
      credentialRef: '00000000-0000-4000-8000-000000000000'
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.message).toMatch(/Secret/)
  })

  it('reveals the secret of a connection just in time', async () => {
    const id = await newSecret()
    await newConnection(id)
    const res = await reveal(id)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ value: 'hunter2' })
  })

  it('does not reveal a secret that no connection uses', async () => {
    const id = await newSecret()
    expect((await reveal(id)).statusCode).toBe(404)
  })

  it('validates the purpose of a reveal', async () => {
    const id = await newSecret()
    await newConnection(id)
    expect((await reveal(id, 'whatever')).statusCode).toBe(400)
  })

  it('requires a signed-in user to reveal', async () => {
    const id = await newSecret()
    await newConnection(id)
    const res = await call(
      'POST',
      `/api/v1/secrets/${id}/reveal`,
      { purpose: 'session' },
      { authorization: '' }
    )
    expect(res.statusCode).toBe(401)
  })

  it('replaces a secret in place', async () => {
    const id = await newSecret('old')
    await newConnection(id)
    expect((await call('PUT', `/api/v1/secrets/${id}`, { value: 'new' })).statusCode).toBe(204)
    expect((await reveal(id)).json().value).toBe('new')
  })

  it('deleting a secret clears it from the connection', async () => {
    const id = await newSecret()
    const conn = await newConnection(id)
    expect((await call('DELETE', `/api/v1/secrets/${id}`)).statusCode).toBe(204)
    expect((await call('GET', `/api/v1/connections/${conn.id}`)).json().credentialRef).toBeNull()
    expect((await call('DELETE', `/api/v1/secrets/${id}`)).statusCode).toBe(404)
  })

  it('deleting a connection deletes its secret', async () => {
    const id = await newSecret()
    const conn = await newConnection(id)
    await call('DELETE', `/api/v1/connections/${conn.id}`)
    const { rows } = await db.query('SELECT id FROM secrets')
    expect(rows).toHaveLength(0)
  })

  it('switching to another secret drops the previous one', async () => {
    const first = await newSecret('a')
    const conn = await newConnection(first)
    const second = await newSecret('b')
    await call('PATCH', `/api/v1/connections/${conn.id}`, { credentialRef: second })
    const { rows } = await db.query('SELECT id FROM secrets')
    expect(rows.map((r) => r.id)).toEqual([second])
  })

  it('duplicating a connection copies its secret under a new id', async () => {
    const id = await newSecret()
    const conn = await newConnection(id)
    const copy = (await call('POST', `/api/v1/connections/${conn.id}/duplicate`)).json()
    expect(copy.credentialRef).toBeTruthy()
    expect(copy.credentialRef).not.toBe(id)
    expect((await reveal(copy.credentialRef)).json().value).toBe('hunter2')
    await call('DELETE', `/api/v1/connections/${copy.id}`)
    expect((await reveal(id)).json().value).toBe('hunter2')
  })

  it('answers 503 when the server has no master key', async () => {
    ;({ app } = await createTestApp({ masterKey: null }))
    ;({ auth } = await login(app))
    const res = await call('POST', '/api/v1/secrets', { value: 'x' })
    expect(res.statusCode).toBe(503)
    expect(res.json().error.code).toBe('secrets_unavailable')
  })
})

describe('audit', () => {
  it('records who read which secret, for what, newest first', async () => {
    const id = await newSecret()
    const conn = await newConnection(id)
    await reveal(id, 'session')
    await reveal(id, 'reveal')
    const res = await call('GET', '/api/v1/audit')
    expect(res.statusCode).toBe(200)
    const reads = res.json().filter((e: { action: string }) => e.action === 'secret.read')
    expect(reads).toHaveLength(2)
    expect(reads[0]).toMatchObject({
      action: 'secret.read',
      userEmail: 'ana@acme.com',
      targetType: 'connection',
      targetId: conn.id,
      targetName: 'web-01',
      detail: { purpose: 'reveal' }
    })
    expect(reads[1].detail.purpose).toBe('session')
    expect(JSON.stringify(res.json())).not.toContain('hunter2')
  })

  it('records writes and deletes of secrets', async () => {
    const id = await newSecret()
    await call('PUT', `/api/v1/secrets/${id}`, { value: 'x' })
    await call('DELETE', `/api/v1/secrets/${id}`)
    const actions = (await call('GET', '/api/v1/audit'))
      .json()
      .map((e: { action: string }) => e.action)
    expect(actions).toEqual(['secret.delete', 'secret.write', 'secret.create'])
  })

  it('is admin only', async () => {
    const member = await login(app, 'bia@acme.com')
    const res = await call('GET', '/api/v1/audit', undefined, member.auth)
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('forbidden')
  })

  it('limits the page size', async () => {
    for (let i = 0; i < 3; i++) await newSecret()
    expect((await call('GET', '/api/v1/audit?limit=2')).json()).toHaveLength(2)
    expect((await call('GET', '/api/v1/audit?limit=0')).statusCode).toBe(400)
  })
})
