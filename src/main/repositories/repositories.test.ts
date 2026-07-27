import { describe, expect, it } from 'vitest'
import { seedDevData } from '../database/seed-data'
import { createTestRepositories } from '../database/test-utils'

describe('repositories', () => {
  it('creates a client hierarchy and lists connections with filters', () => {
    const { repos } = createTestRepositories()

    const client = repos.clients.create({ name: 'Acme', color: '#fff' })
    const env = repos.environments.create({ clientId: client.id, name: 'Prod' })
    const group = repos.groups.create({ environmentId: env.id, name: 'App' })
    const tag = repos.tags.create({ name: 'linux' })

    const conn = repos.connections.create({
      groupId: group.id,
      name: 'web-01',
      protocol: 'ssh',
      host: '10.0.0.1',
      port: 22,
      authMethod: 'key',
      isFavorite: true,
      links: [{ label: 'Docs', url: 'https://example.com' }],
      vpnRequired: true
    })

    repos.tags.setForConnection({ connectionId: conn.id, tagIds: [tag.id] })

    expect(repos.clients.list()).toHaveLength(1)
    expect(repos.connections.list({ isFavorite: true })).toHaveLength(1)
    expect(repos.connections.list({ tagId: tag.id })).toHaveLength(1)
    expect(repos.connections.list({ clientId: client.id })).toHaveLength(1)
    expect(repos.tags.listForConnection(conn.id).map((t) => t.name)).toEqual(['linux'])
    expect(repos.connections.get(conn.id)?.links).toEqual([
      { label: 'Docs', url: 'https://example.com' }
    ])
  })

  it('cascades delete from client to connections', () => {
    const { repos } = createTestRepositories()
    const client = repos.clients.create({ name: 'Temp' })
    const env = repos.environments.create({ clientId: client.id, name: 'Env' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    repos.connections.create({
      groupId: group.id,
      name: 'c1',
      protocol: 'ssh',
      host: 'h',
      port: 22,
      authMethod: 'none'
    })

    expect(repos.clients.delete(client.id)).toBe(true)
    expect(repos.environments.list()).toHaveLength(0)
    expect(repos.groups.list()).toHaveLength(0)
    expect(repos.connections.list()).toHaveLength(0)
  })

  it('toggles favorite and duplicates a connection', () => {
    const { repos } = createTestRepositories()
    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const original = repos.connections.create({
      groupId: group.id,
      name: 'api',
      protocol: 'ssh',
      host: 'api.local',
      port: 22,
      authMethod: 'agent',
      isFavorite: false
    })

    const toggled = repos.connections.toggleFavorite(original.id)
    expect(toggled?.isFavorite).toBe(true)

    const copy = repos.connections.duplicate(original.id)
    expect(copy?.name).toBe('api (copy)')
    expect(copy?.isFavorite).toBe(false)
    expect(copy?.id).not.toBe(original.id)
    expect(repos.connections.list()).toHaveLength(2)
  })

  it('records history and updates access stats in a transaction', () => {
    const { repos } = createTestRepositories()
    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const conn = repos.connections.create({
      groupId: group.id,
      name: 'api',
      protocol: 'ssh',
      host: 'api.local',
      port: 22,
      authMethod: 'agent'
    })

    const entry = repos.history.record({
      connectionId: conn.id,
      success: true,
      durationMs: 1500
    })

    expect(entry.success).toBe(true)
    expect(repos.history.list({ connectionId: conn.id })).toHaveLength(1)

    const updated = repos.connections.get(conn.id)
    expect(updated?.accessCount).toBe(1)
    expect(updated?.totalConnectedMs).toBe(1500)
    expect(updated?.lastConnectedAt).toBeTruthy()

    repos.history.record({
      connectionId: conn.id,
      success: false,
      errorMessage: 'timeout',
      durationMs: 100
    })

    const afterFail = repos.connections.get(conn.id)
    expect(afterFail?.accessCount).toBe(1)
    expect(afterFail?.totalConnectedMs).toBe(1500)
  })

  it('seeds ~10 connections across two clients', () => {
    const { repos } = createTestRepositories()
    seedDevData(repos)

    expect(repos.clients.list()).toHaveLength(2)
    expect(repos.connections.list().length).toBeGreaterThanOrEqual(10)
    expect(repos.tags.list().length).toBeGreaterThanOrEqual(3)
  })
})
