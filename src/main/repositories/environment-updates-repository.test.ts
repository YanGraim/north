import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'

function seedChain(repos: ReturnType<typeof createTestRepositories>['repos']) {
  const client = repos.clients.create({ name: 'Acme' })
  const environment = repos.environments.create({ clientId: client.id, name: 'release' })
  const group = repos.groups.create({ environmentId: environment.id, name: 'api' })
  const connection = repos.connections.create({
    groupId: group.id,
    name: 'wms-api',
    protocol: 'ssh',
    host: '10.0.0.1',
    port: 22,
    authMethod: 'password'
  })
  const workflow = repos.workflows.create({ groupId: group.id, name: 'Update Backend' })
  const run = repos.workflowRuns.create({
    workflowId: workflow.id,
    groupId: group.id,
    mode: 'live',
    targets: [{ connectionId: connection.id }],
    definitionSnapshot: workflow.definition,
    variablesSnapshot: {},
    inputValues: {}
  })
  return { environment, connection, workflow, run }
}

describe('EnvironmentUpdatesRepository', () => {
  it('creates and lists updates for an environment, newest first', () => {
    const { repos } = createTestRepositories()
    const { environment, connection, workflow, run } = seedChain(repos)

    const first = repos.environmentUpdates.create({
      environmentId: environment.id,
      connectionId: connection.id,
      workflowId: workflow.id,
      workflowRunId: run.id,
      branch: 'release',
      previousCommit: 'a1',
      currentCommit: 'b2',
      startedAt: '2026-01-01T10:00:00.000Z',
      finishedAt: '2026-01-01T10:02:00.000Z',
      status: 'success',
      commits: [{ hash: 'b2', message: 'fix: conference issue' }],
      filesChanged: 3
    })

    const second = repos.environmentUpdates.create({
      environmentId: environment.id,
      connectionId: connection.id,
      workflowId: workflow.id,
      workflowRunId: run.id,
      branch: 'release',
      previousCommit: 'b2',
      currentCommit: 'c3',
      startedAt: '2026-01-02T10:00:00.000Z',
      finishedAt: '2026-01-02T10:02:00.000Z',
      status: 'failed',
      commits: [
        { hash: 'c3', message: 'feat: report' },
        { hash: 'c2', message: 'fix: integration' }
      ],
      filesChanged: 23
    })

    const list = repos.environmentUpdates.listByEnvironment(environment.id)
    expect(list.map((u) => u.id)).toEqual([second.id, first.id])
    expect(list[0]?.commits).toHaveLength(2)
    expect(list[0]?.status).toBe('failed')
    expect(list[1]?.filesChanged).toBe(3)

    expect(repos.environmentUpdates.get(first.id)?.previousCommit).toBe('a1')
    expect(repos.environmentUpdates.get('missing')).toBeNull()
  })

  it('scopes listings to the given environment', () => {
    const { repos } = createTestRepositories()
    const chainA = seedChain(repos)
    const chainB = seedChain(repos)

    repos.environmentUpdates.create({
      environmentId: chainA.environment.id,
      connectionId: chainA.connection.id,
      workflowId: chainA.workflow.id,
      workflowRunId: chainA.run.id,
      branch: 'release',
      previousCommit: 'a1',
      currentCommit: 'a2',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:01:00.000Z',
      status: 'success',
      commits: [],
      filesChanged: 0
    })

    expect(repos.environmentUpdates.listByEnvironment(chainA.environment.id)).toHaveLength(1)
    expect(repos.environmentUpdates.listByEnvironment(chainB.environment.id)).toHaveLength(0)
  })

  it('listRecent returns updates across every environment, newest first', () => {
    const { repos } = createTestRepositories()
    const chainA = seedChain(repos)
    const chainB = seedChain(repos)

    repos.environmentUpdates.create({
      environmentId: chainA.environment.id,
      connectionId: chainA.connection.id,
      workflowId: chainA.workflow.id,
      workflowRunId: chainA.run.id,
      branch: 'release',
      previousCommit: 'a1',
      currentCommit: 'a2',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:01:00.000Z',
      status: 'success',
      commits: [],
      filesChanged: 0
    })
    const secondFromB = repos.environmentUpdates.create({
      environmentId: chainB.environment.id,
      connectionId: chainB.connection.id,
      workflowId: chainB.workflow.id,
      workflowRunId: chainB.run.id,
      branch: 'main',
      previousCommit: 'b1',
      currentCommit: 'b2',
      startedAt: '2026-01-02T00:00:00.000Z',
      finishedAt: '2026-01-02T00:01:00.000Z',
      status: 'success',
      commits: [],
      filesChanged: 0
    })

    const recent = repos.environmentUpdates.listRecent()
    expect(recent).toHaveLength(2)
    expect(recent[0]?.id).toBe(secondFromB.id)
    expect(new Set(recent.map((u) => u.environmentId))).toEqual(
      new Set([chainA.environment.id, chainB.environment.id])
    )
  })

  it('cascades delete when the environment is removed', () => {
    const { repos } = createTestRepositories()
    const { environment, connection, workflow, run } = seedChain(repos)
    const update = repos.environmentUpdates.create({
      environmentId: environment.id,
      connectionId: connection.id,
      workflowId: workflow.id,
      workflowRunId: run.id,
      branch: 'release',
      previousCommit: 'a1',
      currentCommit: 'a2',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:01:00.000Z',
      status: 'success',
      commits: [],
      filesChanged: 0
    })

    repos.environments.delete(environment.id)
    expect(repos.environmentUpdates.get(update.id)).toBeNull()
  })
})
