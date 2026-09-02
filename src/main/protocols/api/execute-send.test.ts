import { emptyApiConfig, emptyApiRequestDefinition } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestRepositories } from '../../database/test-utils'
import { CredentialVault, FakeEncryptor } from '../../vault'
import { clientIdForAccess, executeApiSend } from './execute-send'
import { executeHttpRequest } from './http-client'

vi.mock('./http-client', () => ({
  executeHttpRequest: vi.fn()
}))

describe('executeApiSend', () => {
  function seed() {
    const { repos } = createTestRepositories()
    const client = repos.clients.create({ name: 'Acme' })
    const environment = repos.environments.create({ clientId: client.id, name: 'HML' })
    const group = repos.groups.create({ environmentId: environment.id, name: 'APIs' })
    const access = repos.accesses.create({
      groupId: group.id,
      type: 'api',
      name: 'Petstore',
      url: 'https://api.example.com'
    })
    const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
    return { repos, vault, client, group, access }
  }

  beforeEach(() => {
    vi.mocked(executeHttpRequest).mockReset()
  })

  it('resolves clientId from access → group → environment', () => {
    const { repos, client, access } = seed()
    expect(clientIdForAccess(repos, access.id)).toBe(client.id)
  })

  it('rejects a non-api environment', async () => {
    const { repos, vault, group } = seed()
    const databaseAccess = repos.accesses.create({
      groupId: group.id,
      type: 'database',
      name: 'Postgres',
      engine: 'postgres'
    })

    await expect(
      executeApiSend(repos, vault, {
        requestId: '11111111-1111-1111-1111-111111111111',
        method: 'GET',
        url: '/health',
        definition: emptyApiRequestDefinition(),
        environmentAccessId: databaseAccess.id
      })
    ).rejects.toThrow(/Ambiente inválido/)
  })

  it('interpolates base URL and variables from the selected environment Access', async () => {
    const { repos, vault, access } = seed()
    repos.apiVariables.upsert({
      accessId: access.id,
      key: 'version',
      value: 'v1',
      isSecret: false
    })
    repos.apiVariables.upsert({
      accessId: access.id,
      key: 'token',
      value: 'secret-token',
      isSecret: false
    })

    vi.mocked(executeHttpRequest).mockResolvedValue({
      requestId: '11111111-1111-1111-1111-111111111111',
      status: 200,
      statusText: 'OK',
      headers: [],
      bodyText: '{}',
      truncated: false,
      durationMs: 1,
      sizeBytes: 2,
      errorKind: null,
      errorMessage: null,
      echoed: {
        method: 'GET',
        url: 'https://api.example.com/v1/users',
        headers: []
      }
    })

    await executeApiSend(repos, vault, {
      requestId: '11111111-1111-1111-1111-111111111111',
      method: 'GET',
      url: '/{{version}}/users',
      definition: {
        ...emptyApiRequestDefinition(),
        headers: [{ key: 'X-Token', value: '{{token}}', enabled: true }]
      },
      environmentAccessId: access.id
    })

    expect(executeHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/v1/users',
        headers: expect.objectContaining({ 'X-Token': 'secret-token' }),
        timeoutMs: 0
      })
    )
  })

  it('coerces a persisted 30000 timeout to 0 (no timeout)', async () => {
    const { repos, vault, group } = seed()
    const legacy = repos.accesses.create({
      groupId: group.id,
      type: 'api',
      name: 'Legacy',
      url: 'https://api.example.com',
      apiConfig: { ...emptyApiConfig(), timeoutMs: 30_000 }
    })
    vi.mocked(executeHttpRequest).mockResolvedValue({
      requestId: '11111111-1111-1111-1111-111111111111',
      status: 200,
      statusText: 'OK',
      headers: [],
      bodyText: '{}',
      truncated: false,
      durationMs: 1,
      sizeBytes: 2,
      errorKind: null,
      errorMessage: null,
      echoed: { method: 'GET', url: 'https://api.example.com/health', headers: [] }
    })

    await executeApiSend(repos, vault, {
      requestId: '11111111-1111-1111-1111-111111111111',
      method: 'GET',
      url: '/health',
      definition: emptyApiRequestDefinition(),
      environmentAccessId: legacy.id
    })

    expect(executeHttpRequest).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 0 }))
  })

  it('keeps a custom timeout other than 30000', async () => {
    const { repos, vault, group } = seed()
    const custom = repos.accesses.create({
      groupId: group.id,
      type: 'api',
      name: 'Custom timeout',
      url: 'https://api.example.com',
      apiConfig: { ...emptyApiConfig(), timeoutMs: 5_000 }
    })
    vi.mocked(executeHttpRequest).mockResolvedValue({
      requestId: '11111111-1111-1111-1111-111111111111',
      status: 200,
      statusText: 'OK',
      headers: [],
      bodyText: '{}',
      truncated: false,
      durationMs: 1,
      sizeBytes: 2,
      errorKind: null,
      errorMessage: null,
      echoed: { method: 'GET', url: 'https://api.example.com/health', headers: [] }
    })

    await executeApiSend(repos, vault, {
      requestId: '11111111-1111-1111-1111-111111111111',
      method: 'GET',
      url: '/health',
      definition: emptyApiRequestDefinition(),
      environmentAccessId: custom.id
    })

    expect(executeHttpRequest).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5_000 }))
  })
})
