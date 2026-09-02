import { emptyApiRequestDefinition } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'

describe('api repositories', () => {
  function seedApiAccess() {
    const { repos } = createTestRepositories()
    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const access = repos.accesses.create({
      groupId: group.id,
      type: 'api',
      name: 'Petstore',
      url: 'https://api.example.com'
    })
    return { repos, client, group, access }
  }

  it('CRUDs collections and nested folders', () => {
    const { repos, client } = seedApiAccess()
    const collection = repos.apiCollections.createCollection({
      clientId: client.id,
      name: 'Users'
    })
    expect(repos.apiCollections.listByClient(client.id)).toHaveLength(1)

    const folder = repos.apiCollections.createFolder({
      collectionId: collection.id,
      name: 'Auth'
    })
    const nested = repos.apiCollections.createFolder({
      collectionId: collection.id,
      parentFolderId: folder.id,
      name: 'Tokens'
    })
    expect(repos.apiCollections.listFolders(collection.id)).toHaveLength(2)
    expect(nested.parentFolderId).toBe(folder.id)

    repos.apiCollections.updateFolder(nested.id, { name: 'OAuth' })
    expect(repos.apiCollections.getFolder(nested.id)?.name).toBe('OAuth')
    expect(repos.apiCollections.deleteFolder(nested.id)).toBe(true)
    expect(repos.apiCollections.updateCollection(collection.id, { name: 'Accounts' })?.name).toBe(
      'Accounts'
    )
    expect(repos.apiCollections.deleteCollection(collection.id)).toBe(true)
  })

  it('creates, duplicates and moves requests with parsed definition', () => {
    const { repos, client } = seedApiAccess()
    const collection = repos.apiCollections.createCollection({
      clientId: client.id,
      name: 'HTTP'
    })
    const folder = repos.apiCollections.createFolder({
      collectionId: collection.id,
      name: 'v1'
    })
    const created = repos.apiRequests.create({
      collectionId: collection.id,
      folderId: folder.id,
      name: 'List users',
      method: 'GET',
      url: '/users',
      definition: {
        ...emptyApiRequestDefinition(),
        queryParams: [{ key: 'limit', value: '10', enabled: true }]
      }
    })
    expect(created.definition.queryParams[0]?.key).toBe('limit')

    const copy = repos.apiRequests.duplicate(created.id)
    expect(copy?.name).toBe('List users (cópia)')
    expect(copy?.definition.queryParams[0]?.value).toBe('10')

    const other = repos.apiCollections.createCollection({
      clientId: client.id,
      name: 'Other'
    })
    const moved = repos.apiRequests.move({
      requestId: created.id,
      collectionId: other.id,
      folderId: null
    })
    expect(moved?.collectionId).toBe(other.id)
    expect(moved?.folderId).toBeNull()
    expect(repos.apiRequests.delete(copy?.id as string)).toBe(true)
  })

  it('upserts variables and stores secrets with null value', () => {
    const { repos, access } = seedApiAccess()
    const plain = repos.apiVariables.upsert({
      accessId: access.id,
      key: 'baseUrl',
      value: 'https://api.example.com',
      isSecret: false
    })
    expect(plain.value).toBe('https://api.example.com')

    const secret = repos.apiVariables.upsert({
      accessId: access.id,
      key: 'token',
      isSecret: true,
      credentialRef: 'cred-ref',
      value: 'should-be-ignored'
    })
    expect(secret.value).toBeNull()
    expect(secret.isSecret).toBe(true)
    expect(secret.credentialRef).toBe('cred-ref')

    const listed = repos.apiVariables.listByAccess(access.id)
    expect(listed).toHaveLength(2)
    expect(repos.apiVariables.delete(plain.id)).toBe(true)
  })

  it('inserts request history by access', () => {
    const { repos, access } = seedApiAccess()
    repos.apiRequestHistory.insert({
      accessId: access.id,
      method: 'GET',
      url: 'https://api.example.com/health',
      statusCode: 200,
      durationMs: 12,
      sizeBytes: 20
    })
    const list = repos.apiRequestHistory.listByAccess(access.id)
    expect(list).toHaveLength(1)
    expect(list[0]?.statusCode).toBe(200)
  })

  it('stores global collections with null clientId', () => {
    const { repos } = seedApiAccess()
    const collection = repos.apiCollections.createCollection({
      clientId: null,
      name: 'Shared'
    })
    expect(collection.clientId).toBeNull()
    expect(repos.apiCollections.listByClient(null).map((item) => item.id)).toContain(collection.id)
  })

  it('defaults apiConfig on api accesses', () => {
    const { access } = seedApiAccess()
    expect(access.apiConfig?.schemaVersion).toBe(1)
    expect(access.apiConfig?.auth.type).toBe('none')
  })

  it('does not delete collections when an Access is deleted', () => {
    const { repos, client, access } = seedApiAccess()
    const collection = repos.apiCollections.createCollection({
      clientId: client.id,
      name: 'Keep me'
    })
    expect(repos.accesses.delete(access.id)).toBe(true)
    expect(repos.apiCollections.getCollection(collection.id)?.name).toBe('Keep me')
  })

  it('deletes only that client collections when a client is deleted, leaving globals', () => {
    const { repos, client } = seedApiAccess()
    const scoped = repos.apiCollections.createCollection({
      clientId: client.id,
      name: 'Client scoped'
    })
    const global = repos.apiCollections.createCollection({
      clientId: null,
      name: 'Global'
    })
    const other = repos.clients.create({ name: 'Other' })
    const otherCollection = repos.apiCollections.createCollection({
      clientId: other.id,
      name: 'Other client'
    })

    expect(repos.clients.delete(client.id)).toBe(true)
    expect(repos.apiCollections.getCollection(scoped.id)).toBeNull()
    expect(repos.apiCollections.getCollection(global.id)?.name).toBe('Global')
    expect(repos.apiCollections.getCollection(otherCollection.id)?.name).toBe('Other client')
  })
})
