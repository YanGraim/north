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

describe('ConnectionHealthEventsRepository', () => {
  it('creates an event and round-trips every field', () => {
    const { repos } = createTestRepositories()
    const connection = seedConnection(repos)

    const event = repos.connectionHealthEvents.create({
      connectionId: connection.id,
      previousStatus: 'up',
      newStatus: 'down',
      latencyMs: null,
      errorMessage: 'ECONNREFUSED'
    })

    expect(event.connectionId).toBe(connection.id)
    expect(event.previousStatus).toBe('up')
    expect(event.newStatus).toBe('down')
    expect(event.errorMessage).toBe('ECONNREFUSED')
    expect(event.occurredAt).toBeTruthy()
  })

  it('listByConnection orders newest first and scopes to the connection', () => {
    const { repos } = createTestRepositories()
    const a = seedConnection(repos)
    const b = seedConnection(repos)

    repos.connectionHealthEvents.create({
      connectionId: a.id,
      previousStatus: null,
      newStatus: 'up'
    })
    repos.connectionHealthEvents.create({
      connectionId: a.id,
      previousStatus: 'up',
      newStatus: 'down'
    })
    repos.connectionHealthEvents.create({
      connectionId: b.id,
      previousStatus: null,
      newStatus: 'up'
    })

    const events = repos.connectionHealthEvents.listByConnection(a.id)
    expect(events).toHaveLength(2)
    expect(events[0]?.newStatus).toBe('down')
    expect(events[1]?.newStatus).toBe('up')
  })

  it('listRecent spans every connection', () => {
    const { repos } = createTestRepositories()
    const a = seedConnection(repos)
    const b = seedConnection(repos)
    repos.connectionHealthEvents.create({
      connectionId: a.id,
      previousStatus: null,
      newStatus: 'up'
    })
    repos.connectionHealthEvents.create({
      connectionId: b.id,
      previousStatus: null,
      newStatus: 'up'
    })

    expect(repos.connectionHealthEvents.listRecent()).toHaveLength(2)
  })
})
