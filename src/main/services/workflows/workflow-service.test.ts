import { describe, expect, it, vi } from 'vitest'
import { createTestDatabase } from '../../database/test-utils'
import { createRepositories } from '../../repositories'
import { CredentialVault, FakeEncryptor } from '../../vault'
import { localWorkflowStore } from '../../workspaces/workflow-store'
import { WorkflowService } from './workflow-service'

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [], getFocusedWindow: () => null }
}))

/** A client behind a VPN: the run must take a VPN lease before SSH and drop it after. */
function setup() {
  const repos = createRepositories(createTestDatabase())
  const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
  const client = repos.clients.create({ name: 'Acme' })
  const env = repos.environments.create({ clientId: client.id, name: 'Prod' })
  const group = repos.groups.create({ environmentId: env.id, name: 'Web' })
  const connection = repos.connections.create({
    groupId: group.id,
    name: 'web-01',
    protocol: 'ssh',
    host: '127.0.0.1',
    port: 1,
    authMethod: 'password',
    username: 'u',
    credentialRef: vault.setSecret('x')
  })
  const calls: string[] = []
  const vpn = {
    ensure: vi.fn(async (_c: unknown, lease: string) => {
      calls.push(`ensure:${lease}`)
    }),
    release: vi.fn((lease: string) => {
      calls.push(`release:${lease}`)
    })
  }
  const events: string[] = []
  const scope = () => ({
    store: localWorkflowStore(repos),
    connection: async (id: string) => repos.connections.get(id),
    group: async (id: string) => repos.groups.get(id),
    resolveSecret: async (ref: string) => vault.resolveSecret(ref)
  })
  const service = new WorkflowService(scope, vault, (_id, e) => events.push(e.type), vpn)
  return { repos, service, group, connection, calls, vpn, events }
}

describe('WorkflowService VPN', () => {
  it('takes a VPN lease for a live run and releases it when the run ends', async () => {
    const { repos, service, group, connection, calls, events } = setup()
    const workflow = repos.workflows.create({
      groupId: group.id,
      name: 'deploy',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: crypto.randomUUID(),
            type: 'ssh.exec',
            name: 'uptime',
            policy: { onFailure: 'stop' },
            config: { command: 'uptime' }
          }
        ]
      }
    })
    const run = await service.startRun({
      workflowId: workflow.id,
      mode: 'live',
      targets: [{ connectionId: connection.id }]
    })
    await vi.waitFor(() => expect(calls).toContain(`release:workflow:${run.id}`), {
      timeout: 10_000
    })
    expect(calls[0]).toBe(`ensure:workflow:${run.id}`)
    // the unreachable host fails the run instead of leaving it running forever
    await vi.waitFor(() => expect(events).toContain('run_finished'))
    expect(repos.workflowRuns.get(run.id)?.status).toBe('failed')
  })

  it('takes and releases a lease when listing git tags', async () => {
    const { service, connection, calls } = setup()
    await expect(service.listGitTags(connection.id, '/srv/app')).rejects.toThrow()
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatch(/^ensure:git-tags:/)
    expect(calls[1]).toMatch(/^release:git-tags:/)
  })
})
