import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'
import { buildSearchIndex } from '../services/search-index'

describe('buildSearchIndex', () => {
  it('flattens org path, host and tags for connections', () => {
    const { repos } = createTestRepositories()

    const client = repos.clients.create({ name: 'Acme Corp' })
    const env = repos.environments.create({ clientId: client.id, name: 'Production' })
    const group = repos.groups.create({ environmentId: env.id, name: 'API' })
    const tag = repos.tags.create({ name: 'critical' })

    const conn = repos.connections.create({
      groupId: group.id,
      name: 'api-gateway',
      protocol: 'ssh',
      host: '10.20.30.40',
      port: 22,
      authMethod: 'password',
      notes: 'VPN obrigatória no jump host',
      owner: 'ops'
    })
    repos.tags.setForConnection({ connectionId: conn.id, tagIds: [tag.id] })

    const index = buildSearchIndex(repos)
    const connectionItem = index.find((item) => item.id === conn.id)

    expect(connectionItem).toMatchObject({
      kind: 'connection',
      name: 'api-gateway',
      host: '10.20.30.40',
      clientName: 'Acme Corp',
      environmentName: 'Production',
      groupName: 'API',
      tags: 'critical',
      notes: 'VPN obrigatória no jump host',
      owner: 'ops',
      protocol: 'ssh'
    })

    expect(index.some((item) => item.kind === 'client' && item.id === client.id)).toBe(true)
    expect(index.some((item) => item.kind === 'tag' && item.id === tag.id)).toBe(true)
  })
})
