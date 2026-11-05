import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'
import type { Repositories } from './index'

function seedConnection(repos: Repositories, name = 'web'): string {
  const client = repos.clients.create({ name: 'C' })
  const env = repos.environments.create({ clientId: client.id, name: 'E' })
  const group = repos.groups.create({ environmentId: env.id, name: 'G' })
  return repos.connections.create({
    groupId: group.id,
    name,
    protocol: 'ssh',
    host: 'h',
    port: 22,
    authMethod: 'none',
    startupDirectory: '/var/www'
  }).id
}

describe('connection directory favorites', () => {
  it('stores normalized paths in insertion order and refuses a duplicate or a relative path', () => {
    const { repos } = createTestRepositories()
    const connectionId = seedConnection(repos)

    expect(repos.directoryFavorites.add(connectionId, '/var/www/html/')).toEqual({
      status: 'added',
      path: '/var/www/html'
    })
    expect(repos.directoryFavorites.add(connectionId, '/etc/apache2/sites-enabled')).toEqual({
      status: 'added',
      path: '/etc/apache2/sites-enabled'
    })
    expect(repos.directoryFavorites.list(connectionId)).toEqual([
      '/var/www/html',
      '/etc/apache2/sites-enabled'
    ])
    expect(repos.directoryFavorites.add(connectionId, '/var/www/html')).toEqual({
      status: 'duplicate',
      path: '/var/www/html'
    })
    expect(repos.directoryFavorites.add(connectionId, 'relative')).toEqual({ status: 'invalid' })
    expect(repos.directoryFavorites.add(connectionId, '~other')).toEqual({ status: 'invalid' })
    expect(repos.directoryFavorites.add(connectionId, '~')).toEqual({ status: 'invalid' })
    expect(repos.connections.get(connectionId)?.startupDirectory).toBe('/var/www')
  })

  it('keeps each connection’s list, and duplicate does not copy it', () => {
    const { repos } = createTestRepositories()
    const original = seedConnection(repos, 'api')
    const other = seedConnection(repos, 'db')
    repos.directoryFavorites.add(original, '/var/log')

    expect(repos.directoryFavorites.list(other)).toEqual([])
    const copy = repos.connections.duplicate(original)
    expect(copy).not.toBeNull()
    expect(repos.directoryFavorites.list(copy?.id ?? '')).toEqual([])
    expect(repos.directoryFavorites.list(original)).toEqual(['/var/log'])
  })

  it('removes one path and drops the list when the local connection is deleted', () => {
    const { repos } = createTestRepositories()
    const connectionId = seedConnection(repos)
    repos.directoryFavorites.add(connectionId, '/var/www/html')
    repos.directoryFavorites.add(connectionId, '/etc')
    repos.directoryFavorites.remove(connectionId, '/etc/')
    expect(repos.directoryFavorites.list(connectionId)).toEqual(['/var/www/html'])

    expect(repos.connections.delete(connectionId)).toBe(true)
    expect(repos.directoryFavorites.list(connectionId)).toEqual([])
  })
})
