import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase } from '../database/test-utils'
import { createRepositories } from '../repositories'
import { WorkspacesRepository } from '../repositories/workspaces-repository'
import { CredentialVault, FakeEncryptor } from '../vault'
import { startTestServer } from './test-server'
import { WorkspaceRegistry } from './workspace-registry'

/** REC-024: an organization's workflows on the server, runs and their passwords on this computer. */
let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  server = await startTestServer()
}, 60_000)
afterAll(() => server.stop())

let seq = 0
async function organization() {
  const db = createTestDatabase()
  const local = createRepositories(db)
  const vault = new CredentialVault(local.credentials, new FakeEncryptor())
  const registry = new WorkspaceRegistry({
    workspaces: new WorkspacesRepository(db),
    local,
    vault,
    liveEvents: false
  })
  const email = `wf-${++seq}@acme.com`
  const org = await registry.addOrganization({ serverUrl: server.url, email })
  await server.makeAdmin(email)
  await registry.activate(org.id)
  const inventory = registry.inventory()
  const client = await inventory.clients.create({ name: `Acme ${seq}` })
  const env = await inventory.environments.create({ clientId: client.id, name: 'Prod' })
  const group = await inventory.groups.create({ environmentId: env.id, name: 'Web' })
  const web = await inventory.connections.create({
    groupId: group.id,
    name: 'web-01',
    protocol: 'ssh',
    host: '10.0.0.2',
    port: 22,
    authMethod: 'password'
  })
  return { registry, local, email, env, group, web }
}

describe('RemoteWorkflowStore', () => {
  it('keeps workflows on the server and the history with who ran it', async () => {
    const { registry, local, email, env, group, web } = await organization()
    const store = registry.workflows()
    const workflow = await store.workflows.create({ groupId: group.id, name: 'Deploy' })
    expect(await store.workflows.listByGroup(group.id)).toEqual([workflow])
    // Nothing landed in this computer's own workflows table.
    expect(local.workflows.listByGroup(group.id)).toEqual([])

    const run = store.runs.create({
      workflowId: workflow.id,
      groupId: group.id,
      mode: 'live',
      targets: [{ connectionId: web.id }],
      definitionSnapshot: workflow.definition,
      variablesSnapshot: {},
      inputValues: {}
    })
    expect(store.runs.get(run.id)?.workflowId).toBe(workflow.id)
    store.connectionSecrets.upsert(web.id, 'git', 'ref-1')
    expect(store.connectionSecrets.getByKind(web.id, 'git')?.credentialRef).toBe('ref-1')

    await store.updates.create({
      environmentId: env.id,
      connectionId: web.id,
      workflowId: workflow.id,
      workflowRunId: run.id,
      branch: 'main',
      previousCommit: 'aaa',
      currentCommit: 'bbb',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'success',
      commits: [],
      filesChanged: 0
    })
    const [update] = await store.updates.listByEnvironment(env.id)
    expect(update).toMatchObject({ currentCommit: 'bbb', ranBy: { email } })

    expect(await store.workflows.delete(workflow.id)).toBe(true)
    expect(await store.workflows.get(workflow.id)).toBeNull()
  })
})
