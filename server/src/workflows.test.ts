import type { FastifyInstance } from 'fastify'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, login } from './test-utils'

/** REC-024: workflows, group variables and environment updates follow their group. */

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

const DEFINITION = {
  schemaVersion: 1,
  inputs: [],
  steps: [
    {
      id: '6f1d3c2a-1b2c-4d5e-8f90-1234567890ab',
      type: 'ssh.exec',
      name: 'pull',
      policy: { onFailure: 'stop' },
      config: { command: 'git pull' }
    }
  ],
  tracking: { type: 'git-update', repositoryPath: '/srv/app' }
}

async function tree() {
  const client = await body(admin, 'POST', '/api/v1/clients', { name: 'Acme' })
  const env = await body(admin, 'POST', '/api/v1/environments', {
    clientId: client.id,
    name: 'Prod'
  })
  const group = await body(admin, 'POST', '/api/v1/groups', { environmentId: env.id, name: 'Web' })
  const web = await body(admin, 'POST', '/api/v1/connections', {
    groupId: group.id,
    name: 'web-01',
    protocol: 'ssh',
    host: '10.0.0.2',
    port: 22,
    authMethod: 'password'
  })
  const workflow = await body(admin, 'POST', '/api/v1/workflows', {
    groupId: group.id,
    name: 'Atualizar backend',
    preferredConnectionId: web.id,
    definition: DEFINITION
  })
  return { client, env, group, web, workflow }
}

const grant = (scopeType: string, scopeId: string, role: string) =>
  body(admin, 'PUT', '/api/v1/admin/grants', { userId: biaId, scopeType, scopeId, role })

const update = (envId: string, connectionId: string, workflowId: string) => ({
  environmentId: envId,
  connectionId,
  workflowId,
  workflowRunId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  branch: 'main',
  previousCommit: 'aaaaaaa',
  currentCommit: 'bbbbbbb',
  startedAt: '2026-11-06T10:00:00.000Z',
  finishedAt: '2026-11-06T10:01:00.000Z',
  status: 'success',
  commits: [{ hash: 'bbbbbbb', message: 'fix login' }],
  filesChanged: 2
})

beforeEach(async () => {
  ;({ app } = await createTestApp())
  ;({ auth: admin } = await login(app, 'ana@acme.com'))
  const member = await login(app, 'bia@acme.com')
  bia = member.auth
  biaId = (await body(bia, 'GET', '/api/v1/me')).id
})

describe('workflows', () => {
  it('keeps the definition and lists by group', async () => {
    const { group, web, workflow } = await tree()
    expect(workflow).toMatchObject({
      groupId: group.id,
      name: 'Atualizar backend',
      preferredConnectionId: web.id,
      definition: DEFINITION
    })
    const list = await body(admin, 'GET', `/api/v1/workflows?groupId=${group.id}`)
    expect(list.map((w: { id: string }) => w.id)).toEqual([workflow.id])
    const renamed = await body(admin, 'PATCH', `/api/v1/workflows/${workflow.id}`, {
      name: 'Deploy'
    })
    expect(renamed.name).toBe('Deploy')
    expect(renamed.definition).toEqual(DEFINITION)
  })

  it('follows the group: none, viewer runs, editor changes', async () => {
    const { client, group, web, workflow } = await tree()
    expect((await call(bia, 'GET', `/api/v1/workflows?groupId=${group.id}`)).statusCode).toBe(404)
    expect((await call(bia, 'GET', `/api/v1/workflows/${workflow.id}`)).statusCode).toBe(404)

    // Only the connection: the group is just the way there, its workflows stay hidden.
    await grant('connection', web.id, 'editor')
    expect((await call(bia, 'GET', `/api/v1/workflows?groupId=${group.id}`)).statusCode).toBe(404)

    await grant('client', client.id, 'viewer')
    expect(await body(bia, 'GET', `/api/v1/workflows?groupId=${group.id}`)).toHaveLength(1)
    const patch = await call(bia, 'PATCH', `/api/v1/workflows/${workflow.id}`, { name: 'x' })
    expect(patch.statusCode).toBe(403)
    const create = await call(bia, 'POST', '/api/v1/workflows', { groupId: group.id, name: 'y' })
    expect(create.statusCode).toBe(403)

    await grant('client', client.id, 'editor')
    await body(bia, 'PATCH', `/api/v1/workflows/${workflow.id}`, { name: 'x' })
    await body(bia, 'DELETE', `/api/v1/workflows/${workflow.id}`)
    expect(await body(admin, 'GET', `/api/v1/workflows?groupId=${group.id}`)).toEqual([])
  })

  it('drops a preferred connection from another group', async () => {
    const { env, workflow } = await tree()
    const other = await body(admin, 'POST', '/api/v1/groups', { environmentId: env.id, name: 'B' })
    const elsewhere = await body(admin, 'POST', '/api/v1/connections', {
      groupId: other.id,
      name: 'b-01',
      protocol: 'ssh',
      host: '10.0.0.9',
      port: 22,
      authMethod: 'password'
    })
    const res = await body(admin, 'PATCH', `/api/v1/workflows/${workflow.id}`, {
      preferredConnectionId: elsewhere.id
    })
    expect(res.preferredConnectionId).toBeNull()
  })
})

describe('group variables', () => {
  it('lists, refuses a repeated key and follows the group grants', async () => {
    const { client, group } = await tree()
    const variable = await body(admin, 'POST', '/api/v1/group-variables', {
      groupId: group.id,
      key: 'APP_DIR',
      value: '/srv/app'
    })
    const again = await call(admin, 'POST', '/api/v1/group-variables', {
      groupId: group.id,
      key: 'APP_DIR',
      value: 'x'
    })
    expect(again.statusCode).toBe(409)

    await grant('client', client.id, 'viewer')
    const list = await body(bia, 'GET', `/api/v1/group-variables?groupId=${group.id}`)
    expect(list).toMatchObject([{ key: 'APP_DIR', value: '/srv/app' }])
    const patch = await call(bia, 'PATCH', `/api/v1/group-variables/${variable.id}`, { value: 'y' })
    expect(patch.statusCode).toBe(403)
    await body(admin, 'PATCH', `/api/v1/group-variables/${variable.id}`, { value: '/opt/app' })
    await body(admin, 'DELETE', `/api/v1/group-variables/${variable.id}`)
    expect(await body(admin, 'GET', `/api/v1/group-variables?groupId=${group.id}`)).toEqual([])
  })
})

describe('environment updates', () => {
  it('records who ran the workflow and shows it to whoever sees the connection', async () => {
    const { client, env, web, workflow } = await tree()
    const denied = await call(bia, 'POST', '/api/v1/environment-updates', {
      ...update(env.id, web.id, workflow.id)
    })
    expect(denied.statusCode).toBe(404)

    await grant('client', client.id, 'viewer')
    const created = await body(bia, 'POST', '/api/v1/environment-updates', {
      ...update(env.id, web.id, workflow.id)
    })
    expect(created.ranBy).toMatchObject({ id: biaId, email: 'bia@acme.com' })

    const recent = await body(admin, 'GET', '/api/v1/environment-updates?limit=10')
    expect(recent).toMatchObject([
      { currentCommit: 'bbbbbbb', ranBy: { email: 'bia@acme.com' }, filesChanged: 2 }
    ])
    const byEnv = await body(bia, 'GET', `/api/v1/environment-updates?environmentId=${env.id}`)
    expect(byEnv).toHaveLength(1)

    // Without the grant the history disappears too.
    await body(admin, 'DELETE', '/api/v1/admin/grants', {
      userId: biaId,
      scopeType: 'client',
      scopeId: client.id
    })
    expect((await call(bia, 'GET', '/api/v1/environment-updates')).json()).toEqual([])
  })

  it('refuses a connection outside the environment', async () => {
    const { client, web, workflow } = await tree()
    const other = await body(admin, 'POST', '/api/v1/environments', {
      clientId: client.id,
      name: 'Hml'
    })
    const res = await call(admin, 'POST', '/api/v1/environment-updates', {
      ...update(other.id, web.id, workflow.id)
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('/me/access teams', () => {
  it('lists the teams the person is in', async () => {
    const team = await body(admin, 'POST', '/api/v1/admin/teams', { name: 'Suporte' })
    await body(admin, 'PUT', `/api/v1/admin/teams/${team.id}/members`, { userId: biaId })
    const me = await body(bia, 'GET', '/api/v1/me/access')
    expect(me.teams).toEqual([{ id: team.id, name: 'Suporte' }])
  })
})
