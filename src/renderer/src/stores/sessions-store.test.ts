import type { SessionDescriptor } from '@shared/protocols'
import type { Access } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  openAccessSession,
  openConnectionSession,
  sessionKindForProtocol,
  useSessionsStore,
  WORKSPACE_TAB_ID
} from './sessions-store'

function resetStore(): void {
  useSessionsStore.setState({
    tabs: [{ id: WORKSPACE_TAB_ID, kind: 'workspace', title: 'Workspace' }],
    activeTabId: WORKSPACE_TAB_ID
  })
}

describe('sessionKindForProtocol', () => {
  it('maps protocols to session kinds', () => {
    expect(sessionKindForProtocol('ssh')).toBe('terminal')
    expect(sessionKindForProtocol('sftp')).toBe('file-transfer')
    expect(sessionKindForProtocol('ftp')).toBe('file-transfer')
    expect(sessionKindForProtocol('vnc')).toBe('desktop')
    expect(sessionKindForProtocol('https')).toBeUndefined()
    expect(sessionKindForProtocol('postgres')).toBe('database')
    expect(sessionKindForProtocol('sqlite')).toBe('database')
  })
})

describe('sessions-store optimistic open', () => {
  const openMock = vi.fn()
  const closeMock = vi.fn()
  const openAccessMock = vi.fn()
  const getAccessMock = vi.fn()

  beforeEach(() => {
    resetStore()
    openMock.mockReset()
    closeMock.mockReset().mockResolvedValue(undefined)
    openAccessMock.mockReset()
    getAccessMock.mockReset()
    Object.assign(globalThis, {
      window: {
        north: {
          sessions: {
            open: openMock,
            openAccess: openAccessMock,
            close: closeMock
          },
          accesses: {
            get: getAccessMock
          },
          connections: {
            get: vi.fn().mockResolvedValue(null)
          },
          groups: {
            get: vi.fn().mockResolvedValue(null)
          },
          environments: {
            get: vi.fn().mockResolvedValue(null)
          },
          clients: {
            get: vi.fn().mockResolvedValue(null)
          }
        }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a connecting tab then attaches port on success', async () => {
    const connectionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const session: SessionDescriptor = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      connectionId,
      kind: 'terminal',
      protocol: 'ssh',
      title: 'prod-box',
      state: 'connected',
      errorMessage: null
    }
    const port = { close: vi.fn() } as unknown as MessagePort

    let resolveOpen!: (value: SessionDescriptor) => void
    openMock.mockImplementation((_connectionId: string, onPort: (p: MessagePort) => void) => {
      onPort(port)
      return new Promise<SessionDescriptor>((resolve) => {
        resolveOpen = resolve
      })
    })

    const pending = openConnectionSession(connectionId, {
      title: 'prod-box',
      protocol: 'ssh',
      username: 'root',
      host: '127.0.0.1'
    })

    const connecting = useSessionsStore.getState()
    expect(connecting.activeTabId).not.toBe(WORKSPACE_TAB_ID)
    const tempTab = connecting.tabs.find((t) => t.kind === 'session')
    expect(tempTab?.state).toBe('connecting')
    expect(tempTab?.port).toBeNull()
    expect(tempTab?.title).toBe('prod-box')
    expect(tempTab?.username).toBe('root')
    const tempTabId = tempTab?.id

    resolveOpen(session)
    await pending

    const done = useSessionsStore.getState()
    const tab = done.tabs.find((t) => t.sessionId === session.id)
    expect(tab?.state).toBe('connected')
    expect(tab?.port).toBe(port)
    expect(tab?.id).toBe(tempTabId)
    expect(done.activeTabId).toBe(tempTabId)
  })

  it('marks the optimistic tab as error when open fails', async () => {
    openMock.mockRejectedValue(new Error('Senha não configurada para esta conexão'))

    await expect(
      openConnectionSession('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', {
        title: 'broken'
      })
    ).rejects.toThrow(/Senha não configurada/)

    const state = useSessionsStore.getState()
    const tab = state.tabs.find((t) => t.kind === 'session')
    expect(tab?.state).toBe('error')
    expect(tab?.errorMessage).toMatch(/Senha não configurada/)
    expect(tab?.port).toBeNull()
  })

  it('closeTab removes the tab and returns to workspace when it was active', async () => {
    const { beginConnectingTab, closeTab } = useSessionsStore.getState()
    beginConnectingTab({
      id: 'temp-1',
      connectionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      title: 'closing'
    })

    expect(useSessionsStore.getState().activeTabId).toBe('temp-1')
    await closeTab('temp-1')

    const state = useSessionsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0]?.id).toBe(WORKSPACE_TAB_ID)
    expect(state.activeTabId).toBe(WORKSPACE_TAB_ID)
    expect(closeMock).not.toHaveBeenCalled()
  })

  it('setAwaitingHostKey flags connecting tabs without a port', () => {
    const { beginConnectingTab, setAwaitingHostKey } = useSessionsStore.getState()
    beginConnectingTab({
      id: 'temp-host',
      connectionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      title: 'host-wait'
    })

    setAwaitingHostKey('cccccccc-cccc-cccc-cccc-cccccccccccc', true)
    expect(
      useSessionsStore.getState().tabs.find((t) => t.id === 'temp-host')?.awaitingHostKey
    ).toBe(true)

    setAwaitingHostKey(null, false)
    expect(
      useSessionsStore.getState().tabs.find((t) => t.id === 'temp-host')?.awaitingHostKey
    ).toBe(false)
  })

  it('opens a database session from Access without a MessagePort', async () => {
    const accessId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const access: Access = {
      id: accessId,
      groupId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      type: 'database',
      name: 'PostgreSQL · wms',
      description: null,
      notes: null,
      username: 'wms',
      credentialRef: null,
      url: null,
      links: [],
      icon: null,
      color: null,
      isFavorite: false,
      engine: 'postgres',
      host: '10.1.1.17',
      port: 5432,
      database: 'wms',
      ssl: false,
      apiConfig: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    const session: SessionDescriptor = {
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      connectionId: null,
      accessId,
      kind: 'database',
      protocol: 'postgres',
      title: access.name,
      state: 'connected',
      errorMessage: null
    }
    getAccessMock.mockResolvedValue(access)
    openAccessMock.mockResolvedValue(session)

    await openAccessSession(accessId, { title: access.name })

    const tab = useSessionsStore.getState().tabs.find((t) => t.sessionId === session.id)
    expect(tab?.sessionKind).toBe('database')
    expect(tab?.accessId).toBe(accessId)
    expect(tab?.port).toBeNull()
    expect(tab?.state).toBe('connected')
    expect(openAccessMock).toHaveBeenCalledWith(accessId)
  })

  it('opens an API access without a MessagePort', async () => {
    const accessId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    getAccessMock.mockResolvedValue({
      id: accessId,
      groupId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      type: 'api',
      name: 'Petstore',
      url: 'https://api.example.com',
      username: null,
      apiConfig: null
    })
    await openAccessSession(accessId, { title: 'Petstore' })

    const tab = useSessionsStore.getState().tabs.find((item) => item.sessionKind === 'api')
    expect(tab?.sessionKind).toBe('api')
    expect(tab?.protocol).toBe('api')
    expect(tab?.environmentAccessId).toBe(accessId)
    expect(tab?.port).toBeUndefined()
    expect(tab?.host).toBe('https://api.example.com')
    expect(tab?.state).toBe('connected')
    expect(openAccessMock).not.toHaveBeenCalled()
  })

  it('rejects Access engines that are not SQL studio', async () => {
    getAccessMock.mockResolvedValue({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      type: 'database',
      engine: 'redis',
      name: 'cache'
    })
    await expect(openAccessSession('cccccccc-cccc-cccc-cccc-cccccccccccc')).rejects.toThrow(
      /não abre sessão SQL/
    )
    expect(openAccessMock).not.toHaveBeenCalled()
  })
})

describe('openWorkflowRunTab org hydrate', () => {
  const connectionsGet = vi.fn()
  const groupsGet = vi.fn()
  const environmentsGet = vi.fn()
  const clientsGet = vi.fn()

  beforeEach(() => {
    resetStore()
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

  it('hydrates environmentName and clientName from the group chain', async () => {
    const groupId = 'group-1'
    groupsGet.mockResolvedValue({ id: groupId, environmentId: 'env-1', name: 'App' })
    environmentsGet.mockResolvedValue({
      id: 'env-1',
      clientId: 'client-1',
      name: 'Homologação',
      color: '#eab308'
    })
    clientsGet.mockResolvedValue({ id: 'client-1', name: 'Ecofitus' })

    useSessionsStore.getState().openWorkflowRunTab({
      runId: 'run-1',
      workflowId: 'wf-1',
      workflowName: 'Atualizar frontend',
      connectionId: 'conn-1',
      groupId
    })

    const created = useSessionsStore.getState().tabs.find((t) => t.kind === 'workflow-run')
    expect(created?.title).toBe('Atualizar frontend')
    expect(created?.groupId).toBe(groupId)

    await vi.waitFor(() => {
      const tab = useSessionsStore.getState().tabs.find((t) => t.kind === 'workflow-run')
      expect(tab?.environmentName).toBe('Homologação')
      expect(tab?.environmentColor).toBe('#eab308')
      expect(tab?.clientName).toBe('Ecofitus')
    })

    expect(connectionsGet).not.toHaveBeenCalled()
    expect(groupsGet).toHaveBeenCalledWith(groupId)
  })
})
