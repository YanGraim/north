import type { SessionDescriptor, SessionKind, SessionState } from '@shared/protocols'
import { create } from 'zustand'

export const WORKSPACE_TAB_ID = 'workspace'

export type SessionTab = {
  id: string
  kind: 'workspace' | 'session'
  title: string
  sessionId?: string
  connectionId?: string
  sessionKind?: SessionKind
  protocol?: string
  username?: string | null
  host?: string | null
  state?: SessionState
  errorMessage?: string | null
  /** True while a host-key / TLS prompt is open for this connecting tab. */
  awaitingHostKey?: boolean
  /** Keep-alive: port lives for the lifetime of the tab. */
  port?: MessagePort | null
}

export type OpenSessionOptions = {
  title?: string
  protocol?: string
  sessionKind?: SessionKind
  username?: string | null
  host?: string | null
}

type SessionsState = {
  tabs: SessionTab[]
  activeTabId: string
  setActiveTab: (id: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  beginConnectingTab: (input: {
    id: string
    connectionId: string
    title: string
    protocol?: string
    sessionKind?: SessionKind
    username?: string | null
    host?: string | null
  }) => void
  attachSessionPort: (input: {
    tempId: string
    session: SessionDescriptor
    port: MessagePort
  }) => void
  failConnectingTab: (tempId: string, errorMessage: string) => void
  setAwaitingHostKey: (sessionIdOrTabId: string | null, awaiting: boolean) => void
  openSessionTab: (input: { session: SessionDescriptor; port: MessagePort }) => void
  updateSessionState: (session: SessionDescriptor) => void
  closeTab: (tabId: string) => Promise<void>
  duplicateTab: (tabId: string) => Promise<void>
}

function workspaceTab(): SessionTab {
  return { id: WORKSPACE_TAB_ID, kind: 'workspace', title: 'Workspace' }
}

export function sessionKindForProtocol(protocol: string): SessionKind | undefined {
  switch (protocol) {
    case 'ssh':
    case 'telnet':
    case 'serial':
      return 'terminal'
    case 'sftp':
    case 'ftp':
      return 'file-transfer'
    case 'vnc':
    case 'rdp':
      return 'desktop'
    default:
      return undefined
  }
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  tabs: [workspaceTab()],
  activeTabId: WORKSPACE_TAB_ID,

  setActiveTab: (id) => set({ activeTabId: id }),

  reorderTabs: (fromIndex, toIndex) => {
    set((state) => {
      if (fromIndex === 0 || toIndex === 0) return state
      if (fromIndex < 1 || toIndex < 1) return state
      if (fromIndex >= state.tabs.length || toIndex >= state.tabs.length) return state

      const next = [...state.tabs]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return { tabs: next }
    })
  },

  beginConnectingTab: ({ id, connectionId, title, protocol, sessionKind, username, host }) => {
    const tab: SessionTab = {
      id,
      kind: 'session',
      title,
      connectionId,
      protocol,
      sessionKind,
      username: username ?? null,
      host: host ?? null,
      state: 'connecting',
      errorMessage: null,
      awaitingHostKey: false,
      port: null
    }
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    }))
  },

  attachSessionPort: ({ tempId, session, port }) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tempId
          ? {
              ...tab,
              sessionId: session.id,
              connectionId: session.connectionId,
              title: session.title || tab.title,
              sessionKind: session.kind,
              protocol: session.protocol,
              state: session.state,
              errorMessage: session.errorMessage ?? null,
              awaitingHostKey: false,
              port
            }
          : tab
      )
    }))
  },

  failConnectingTab: (tempId, errorMessage) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tempId
          ? {
              ...tab,
              state: 'error' as const,
              errorMessage,
              awaitingHostKey: false
            }
          : tab
      )
    }))
  },

  setAwaitingHostKey: (sessionIdOrTabId, awaiting) => {
    set((state) => {
      if (sessionIdOrTabId === null) {
        return {
          tabs: state.tabs.map((tab) =>
            tab.awaitingHostKey ? { ...tab, awaitingHostKey: false } : tab
          )
        }
      }

      const matchById = state.tabs.some(
        (tab) => tab.id === sessionIdOrTabId || tab.sessionId === sessionIdOrTabId
      )

      return {
        tabs: state.tabs.map((tab) => {
          if (tab.kind !== 'session') return tab
          if (matchById) {
            if (tab.id === sessionIdOrTabId || tab.sessionId === sessionIdOrTabId) {
              return { ...tab, awaitingHostKey: awaiting }
            }
            return tab
          }
          // sessions:open is still pending — optimistic tab has a temp id, not sessionId yet
          if (awaiting && tab.state === 'connecting' && !tab.port) {
            return { ...tab, awaitingHostKey: true }
          }
          if (!awaiting && tab.awaitingHostKey) {
            return { ...tab, awaitingHostKey: false }
          }
          return tab
        })
      }
    })
  },

  openSessionTab: ({ session, port }) => {
    const tab: SessionTab = {
      id: session.id,
      kind: 'session',
      title: session.title,
      sessionId: session.id,
      connectionId: session.connectionId,
      sessionKind: session.kind,
      protocol: session.protocol,
      state: session.state,
      errorMessage: session.errorMessage ?? null,
      awaitingHostKey: false,
      port
    }
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    }))
  },

  updateSessionState: (session) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.sessionId === session.id || tab.id === session.id
          ? {
              ...tab,
              title: session.title || tab.title,
              state: session.state,
              errorMessage: session.errorMessage ?? null
            }
          : tab
      )
    }))
  },

  closeTab: async (tabId) => {
    if (tabId === WORKSPACE_TAB_ID) return
    const state = get()
    const tab = state.tabs.find((t) => t.id === tabId)
    if (!tab) return

    if (tab.sessionId) {
      try {
        await window.north.sessions.close(tab.sessionId)
      } catch {
        // session may already be closed on the main side
      }
    }

    try {
      tab.port?.close()
    } catch {
      // ignore
    }

    set((current) => {
      const tabs = current.tabs.filter((t) => t.id !== tabId)
      const activeTabId =
        current.activeTabId === tabId
          ? (tabs[tabs.length - 1]?.id ?? WORKSPACE_TAB_ID)
          : current.activeTabId
      return { tabs, activeTabId }
    })
  },

  duplicateTab: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab?.connectionId) return
    await openConnectionSession(tab.connectionId, {
      title: tab.title,
      protocol: tab.protocol,
      sessionKind: tab.sessionKind,
      username: tab.username,
      host: tab.host
    })
  }
}))

export async function openConnectionSession(
  connectionId: string,
  options?: OpenSessionOptions
): Promise<void> {
  const store = useSessionsStore.getState()
  const tempId = crypto.randomUUID()
  const title = options?.title?.trim() || 'Conectando…'
  const sessionKind =
    options?.sessionKind ??
    (options?.protocol ? sessionKindForProtocol(options.protocol) : undefined)

  store.beginConnectingTab({
    id: tempId,
    connectionId,
    title,
    protocol: options?.protocol,
    sessionKind,
    username: options?.username,
    host: options?.host
  })

  try {
    let port: MessagePort | null = null
    const session = await window.north.sessions.open(connectionId, (received) => {
      port = received
    })
    if (!port) {
      throw new Error('Session MessagePort missing')
    }
    store.attachSessionPort({ tempId, session, port })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao conectar'
    store.failConnectingTab(tempId, message)
    throw error
  }
}
