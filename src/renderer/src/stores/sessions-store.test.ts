import type { SessionDescriptor } from '@shared/protocols'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
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
    expect(sessionKindForProtocol('vnc')).toBe('desktop')
    expect(sessionKindForProtocol('https')).toBeUndefined()
  })
})

describe('sessions-store optimistic open', () => {
  const openMock = vi.fn()
  const closeMock = vi.fn()

  beforeEach(() => {
    resetStore()
    openMock.mockReset()
    closeMock.mockReset().mockResolvedValue(undefined)
    Object.assign(globalThis, {
      window: {
        north: {
          sessions: {
            open: openMock,
            close: closeMock
          }
        }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a connecting tab then attaches port on success', async () => {
    const session: SessionDescriptor = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      connectionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
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

    const pending = openConnectionSession(session.connectionId, {
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
})
