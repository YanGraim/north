import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resolveConnectionEnvironment,
  resolveOrgContext,
  workflowRunFolderLabel
} from './resolve-connection-environment'

const GROUP_ID = 'group-1'
const ENV_ID = 'env-1'
const CLIENT_ID = 'client-1'
const CONNECTION_ID = 'conn-1'

describe('resolveOrgContext', () => {
  const connectionsGet = vi.fn()
  const groupsGet = vi.fn()
  const environmentsGet = vi.fn()
  const clientsGet = vi.fn()

  beforeEach(() => {
    connectionsGet.mockReset()
    groupsGet.mockReset()
    environmentsGet.mockReset()
    clientsGet.mockReset()
    Object.assign(globalThis, {
      window: {
        north: {
          connections: { get: connectionsGet },
          groups: { get: groupsGet },
          environments: { get: environmentsGet },
          clients: { get: clientsGet }
        }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves client and environment from groupId without connections.get', async () => {
    groupsGet.mockResolvedValue({ id: GROUP_ID, environmentId: ENV_ID, name: 'App' })
    environmentsGet.mockResolvedValue({
      id: ENV_ID,
      clientId: CLIENT_ID,
      name: 'Homologação',
      color: '#eab308'
    })
    clientsGet.mockResolvedValue({ id: CLIENT_ID, name: 'Ecofitus' })

    const ctx = await resolveOrgContext({ groupId: GROUP_ID })

    expect(ctx).toEqual({
      clientName: 'Ecofitus',
      environmentName: 'Homologação',
      environmentColor: '#eab308'
    })
    expect(connectionsGet).not.toHaveBeenCalled()
    expect(groupsGet).toHaveBeenCalledWith(GROUP_ID)
    expect(environmentsGet).toHaveBeenCalledWith(ENV_ID)
    expect(clientsGet).toHaveBeenCalledWith(CLIENT_ID)
  })

  it('falls back to connectionId when groupId is missing', async () => {
    connectionsGet.mockResolvedValue({ id: CONNECTION_ID, groupId: GROUP_ID, name: 'web-01' })
    groupsGet.mockResolvedValue({ id: GROUP_ID, environmentId: ENV_ID, name: 'App' })
    environmentsGet.mockResolvedValue({
      id: ENV_ID,
      clientId: CLIENT_ID,
      name: 'Prod',
      color: '#ef4444'
    })
    clientsGet.mockResolvedValue({ id: CLIENT_ID, name: 'Cliente A' })

    const ctx = await resolveOrgContext({ connectionId: CONNECTION_ID })

    expect(ctx?.clientName).toBe('Cliente A')
    expect(ctx?.environmentName).toBe('Prod')
    expect(connectionsGet).toHaveBeenCalledWith(CONNECTION_ID)
  })

  it('returns null when environments.get is missing', async () => {
    groupsGet.mockResolvedValue({ id: GROUP_ID, environmentId: ENV_ID, name: 'App' })
    environmentsGet.mockResolvedValue(null)

    expect(await resolveOrgContext({ groupId: GROUP_ID })).toBeNull()
  })
})

describe('resolveConnectionEnvironment', () => {
  it('keeps { name, color } for session tabs', async () => {
    Object.assign(globalThis, {
      window: {
        north: {
          connections: {
            get: vi.fn().mockResolvedValue({ id: 'c1', groupId: 'g1', name: 'box' })
          },
          groups: { get: vi.fn().mockResolvedValue({ id: 'g1', environmentId: 'e1' }) },
          environments: {
            get: vi.fn().mockResolvedValue({
              id: 'e1',
              clientId: 'cl1',
              name: 'Prod',
              color: '#ef4444'
            })
          },
          clients: { get: vi.fn().mockResolvedValue({ id: 'cl1', name: 'Acme' }) }
        }
      }
    })

    await expect(resolveConnectionEnvironment('c1')).resolves.toEqual({
      name: 'Prod',
      color: '#ef4444'
    })
  })
})

describe('workflowRunFolderLabel', () => {
  it('uses the client name when the environment has HML/PROD/DEV context', () => {
    expect(workflowRunFolderLabel('Ecofitus', 'Homologação')).toBe('Ecofitus')
    expect(workflowRunFolderLabel('Ecofitus', 'Prod')).toBe('Ecofitus')
  })

  it('appends the environment name when the badge would be hidden', () => {
    expect(workflowRunFolderLabel('Ecofitus', 'UAT')).toBe('Ecofitus · UAT')
  })

  it('falls back to the connection name when the client is missing', () => {
    expect(workflowRunFolderLabel(null, 'Prod', 'web-01')).toBe('web-01')
  })
})
