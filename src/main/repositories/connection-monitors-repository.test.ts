import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'

function seedConnection(repos: ReturnType<typeof createTestRepositories>['repos']) {
  const client = repos.clients.create({ name: 'Acme' })
  const environment = repos.environments.create({ clientId: client.id, name: 'prod' })
  const group = repos.groups.create({ environmentId: environment.id, name: 'infra' })
  return repos.connections.create({
    groupId: group.id,
    name: 'bastion',
    protocol: 'ssh',
    host: '10.0.0.1',
    port: 22,
    authMethod: 'password'
  })
}

describe('ConnectionMonitorsRepository', () => {
  it('returns null for a connection with no monitor row yet', () => {
    const { repos } = createTestRepositories()
    const connection = seedConnection(repos)
    expect(repos.connectionMonitors.get(connection.id)).toBeNull()
  })

  it('setEnabled creates the row on first call and toggles it after', () => {
    const { repos } = createTestRepositories()
    const connection = seedConnection(repos)

    const enabled = repos.connectionMonitors.setEnabled(connection.id, true)
    expect(enabled).toEqual({
      connectionId: connection.id,
      enabled: true,
      lastStatus: null,
      lastCheckedAt: null
    })

    const disabled = repos.connectionMonitors.setEnabled(connection.id, false)
    expect(disabled.enabled).toBe(false)
  })

  it('listEnabled only returns monitors with enabled = true', () => {
    const { repos } = createTestRepositories()
    const a = seedConnection(repos)
    const b = seedConnection(repos)
    repos.connectionMonitors.setEnabled(a.id, true)
    repos.connectionMonitors.setEnabled(b.id, false)

    const enabled = repos.connectionMonitors.listEnabled()
    expect(enabled.map((m) => m.connectionId)).toEqual([a.id])
  })

  it('recordStatus updates lastStatus and lastCheckedAt', () => {
    const { repos } = createTestRepositories()
    const connection = seedConnection(repos)
    repos.connectionMonitors.setEnabled(connection.id, true)

    repos.connectionMonitors.recordStatus(connection.id, 'up')

    const monitor = repos.connectionMonitors.get(connection.id)
    expect(monitor?.lastStatus).toBe('up')
    expect(monitor?.lastCheckedAt).not.toBeNull()
  })
})
