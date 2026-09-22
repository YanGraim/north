import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestRepositories } from '../database/test-utils'
import { ConnectionMonitorService } from './connection-monitor-service'

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

describe('ConnectionMonitorService', () => {
  let repos: ReturnType<typeof createTestRepositories>['repos']

  beforeEach(() => {
    repos = createTestRepositories().repos
  })

  it('skips connections without monitoring enabled', async () => {
    const connection = seedConnection(repos)
    const checkPort = vi.fn()
    const service = new ConnectionMonitorService(repos, { checkPort })

    await service.checkAllOnce()

    expect(checkPort).not.toHaveBeenCalled()
    expect(repos.connectionMonitors.get(connection.id)).toBeNull()
  })

  it('records an event and calls onChange on the first check (null → up)', async () => {
    const connection = seedConnection(repos)
    repos.connectionMonitors.setEnabled(connection.id, true)
    const checkPort = vi.fn().mockResolvedValue({ ok: true, latencyMs: 12 })
    const onChange = vi.fn()
    const service = new ConnectionMonitorService(repos, { checkPort, onChange })

    await service.checkAllOnce()

    expect(checkPort).toHaveBeenCalledWith('10.0.0.1', 22)
    expect(onChange).toHaveBeenCalledWith({ connectionId: connection.id, status: 'up' })
    const events = repos.connectionHealthEvents.listByConnection(connection.id)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ previousStatus: null, newStatus: 'up', latencyMs: 12 })
    expect(repos.connectionMonitors.get(connection.id)?.lastStatus).toBe('up')
  })

  it('does not record a new event or call onChange when status is unchanged', async () => {
    const connection = seedConnection(repos)
    repos.connectionMonitors.setEnabled(connection.id, true)
    const checkPort = vi.fn().mockResolvedValue({ ok: true, latencyMs: 5 })
    const onChange = vi.fn()
    const service = new ConnectionMonitorService(repos, { checkPort, onChange })

    await service.checkAllOnce()
    onChange.mockClear()
    await service.checkAllOnce()

    expect(onChange).not.toHaveBeenCalled()
    expect(repos.connectionHealthEvents.listByConnection(connection.id)).toHaveLength(1)
  })

  it('records a transition and calls onChange when a host goes down', async () => {
    const connection = seedConnection(repos)
    repos.connectionMonitors.setEnabled(connection.id, true)
    const checkPort = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, latencyMs: 5 })
      .mockResolvedValueOnce({ ok: false, latencyMs: 5000, error: 'ETIMEDOUT' })
    const onChange = vi.fn()
    const service = new ConnectionMonitorService(repos, { checkPort, onChange })

    await service.checkAllOnce()
    await service.checkAllOnce()

    expect(onChange).toHaveBeenLastCalledWith({ connectionId: connection.id, status: 'down' })
    const events = repos.connectionHealthEvents.listByConnection(connection.id)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      previousStatus: 'up',
      newStatus: 'down',
      errorMessage: 'ETIMEDOUT'
    })
  })

  it('ignores connections whose monitor was disabled after being enabled', async () => {
    const connection = seedConnection(repos)
    repos.connectionMonitors.setEnabled(connection.id, true)
    repos.connectionMonitors.setEnabled(connection.id, false)
    const checkPort = vi.fn()
    const service = new ConnectionMonitorService(repos, { checkPort })

    await service.checkAllOnce()

    expect(checkPort).not.toHaveBeenCalled()
  })
})
