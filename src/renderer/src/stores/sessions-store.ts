import { formatIpcError } from '@renderer/lib/ipc-error'
import { releaseStaleBodyPointerEvents } from '@renderer/lib/release-body-pointer-events'
import {
  resolveConnectionEnvironment,
  resolveOrgContext
} from '@renderer/lib/resolve-connection-environment'
import type { SessionDescriptor, SessionKind, SessionState } from '@shared/protocols'
import { create } from 'zustand'

export const WORKSPACE_TAB_ID = 'workspace'

export type SessionTab = {
  id: string
  kind: 'workspace' | 'session' | 'workflow-run'
  title: string
  sessionId?: string
  connectionId?: string | null
  accessId?: string | null
  collectionId?: string | null
  environmentAccessId?: string | null
  clientId?: string | null
  sessionKind?: SessionKind
  protocol?: string
  username?: string | null
  host?: string | null
  environmentName?: string | null
  environmentColor?: string | null
  clientName?: string | null
  groupId?: string | null
  state?: SessionState
  errorMessage?: string | null
  /** True while a host-key / TLS prompt is open for this connecting tab. */
  awaitingHostKey?: boolean
  /** Keep-alive: port lives for the lifetime of the tab. */
  port?: MessagePort | null
  /** Workflow run tab fields */
  workflowId?: string
  workflowRunId?: string
  workflowName?: string
}

export type OpenSessionOptions = {
  title?: string
  protocol?: string
  sessionKind?: SessionKind
  username?: string | null
  host?: string | null
  environmentName?: string | null
  environmentColor?: string | null
}

type SessionsState = {
  tabs: SessionTab[]
  activeTabId: string
  setActiveTab: (id: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  beginConnectingTab: (input: {
    id: string
    connectionId?: string | null
    accessId?: string | null
    title: string
    protocol?: string
    sessionKind?: SessionKind
    username?: string | null
    host?: string | null
    environmentName?: string | null
    environmentColor?: string | null
  }) => void
  attachSessionPort: (input: {
    tempId: string
    session: SessionDescriptor
    port: MessagePort | null
  }) => void
  failConnectingTab: (tempId: string, errorMessage: string) => void
  setAwaitingHostKey: (sessionIdOrTabId: string | null, awaiting: boolean) => void
  openSessionTab: (input: { session: SessionDescriptor; port: MessagePort }) => void
  updateSessionState: (session: SessionDescriptor) => void
  closeTab: (tabId: string) => Promise<void>
  duplicateTab: (tabId: string) => Promise<void>
  openWorkflowRunTab: (input: {
    runId: string
    workflowId: string
    workflowName: string
    connectionId: string
    groupId?: string | null
  }) => void
  /** Rebind an existing workflow-run tab to a new run (e.g. Retry after failure). */
  attachWorkflowRunToTab: (tabId: string, runId: string) => void
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
    case 'postgres':
    case 'mysql':
    case 'mariadb':
    case 'mssql':
    case 'sqlite':
      return 'database'
    default:
      return undefined
  }
}

export function sessionKindForEngine(engine: string | null | undefined): SessionKind | undefined {
  if (!engine) return undefined
  return sessionKindForProtocol(engine)
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  tabs: [workspaceTab()],
  activeTabId: WORKSPACE_TAB_ID,

  setActiveTab: (id) => {
    set({ activeTabId: id })
    window.setTimeout(releaseStaleBodyPointerEvents, 0)
  },

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

  beginConnectingTab: ({
    id,
    connectionId,
    accessId,
    title,
    protocol,
    sessionKind,
    username,
    host,
    environmentName,
    environmentColor
  }) => {
    const tab: SessionTab = {
      id,
      kind: 'session',
      title,
      connectionId: connectionId ?? null,
      accessId: accessId ?? null,
      protocol,
      sessionKind,
      username: username ?? null,
      host: host ?? null,
      environmentName: environmentName ?? null,
      environmentColor: environmentColor ?? null,
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
              connectionId: session.connectionId ?? tab.connectionId ?? null,
              accessId: session.accessId ?? tab.accessId ?? null,
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
      accessId: session.accessId ?? null,
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

    if (tab.kind === 'workflow-run' && tab.workflowRunId) {
      try {
        await window.north.workflows.cancel(tab.workflowRunId)
      } catch {
        // run may already be finished
      }
    }

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
    if (!tab || tab.kind === 'workflow-run') return
    if (tab.sessionKind === 'api') {
      openApiStudioTab({
        collectionId: tab.collectionId,
        collectionName: tab.title,
        environmentAccessId: tab.environmentAccessId ?? tab.accessId,
        clientId: tab.clientId,
        title: tab.title,
        host: tab.host,
        environmentName: tab.environmentName,
        environmentColor: tab.environmentColor
      })
      return
    }
    if (tab.accessId) {
      await openAccessSession(tab.accessId, {
        title: tab.title,
        protocol: tab.protocol,
        sessionKind: tab.sessionKind,
        username: tab.username,
        host: tab.host,
        environmentName: tab.environmentName,
        environmentColor: tab.environmentColor
      })
      return
    }
    if (!tab.connectionId) return
    await openConnectionSession(tab.connectionId, {
      title: tab.title,
      protocol: tab.protocol,
      sessionKind: tab.sessionKind,
      username: tab.username,
      host: tab.host,
      environmentName: tab.environmentName,
      environmentColor: tab.environmentColor
    })
  },

  openWorkflowRunTab: (input) => {
    const tab: SessionTab = {
      id: `workflow-run-${input.runId}`,
      kind: 'workflow-run',
      title: input.workflowName,
      connectionId: input.connectionId,
      groupId: input.groupId,
      workflowId: input.workflowId,
      workflowRunId: input.runId,
      workflowName: input.workflowName
    }
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    }))
    void hydrateWorkflowRunOrg(tab.id, {
      groupId: input.groupId,
      connectionId: input.connectionId
    })
  },

  attachWorkflowRunToTab: (tabId, runId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, workflowRunId: runId } : t))
    }))
  }
}))

async function hydrateWorkflowRunOrg(
  tabId: string,
  input: { groupId?: string | null; connectionId?: string | null }
): Promise<void> {
  const ctx = await resolveOrgContext({
    groupId: input.groupId,
    connectionId: input.groupId ? undefined : input.connectionId
  })
  if (!ctx) return
  useSessionsStore.setState((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            environmentName: ctx.environmentName,
            environmentColor: ctx.environmentColor,
            clientName: ctx.clientName
          }
        : tab
    )
  }))
}

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
    host: options?.host,
    environmentName: options?.environmentName ?? null,
    environmentColor: options?.environmentColor ?? null
  })

  if (!options?.environmentName) {
    void resolveConnectionEnvironment(connectionId).then((resolved) => {
      if (!resolved) return
      useSessionsStore.setState((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.id === tempId
            ? {
                ...tab,
                environmentName: resolved.name,
                environmentColor: resolved.color
              }
            : tab
        )
      }))
    })
  }

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
    const message = formatIpcError(error, 'Falha ao conectar')
    store.failConnectingTab(tempId, message)
    throw error
  }
}

export async function openAccessSession(
  accessId: string,
  options?: OpenSessionOptions
): Promise<void> {
  const access = await window.north.accesses.get(accessId)
  if (!access) {
    throw new Error('Acesso não encontrado')
  }

  if (access.type === 'api') {
    const group = await window.north.groups.get(access.groupId)
    const environment = group ? await window.north.environments.get(group.environmentId) : null
    openApiStudioTab({
      environmentAccessId: access.id,
      clientId: environment?.clientId ?? null,
      title: options?.title?.trim() || access.name,
      host: options?.host ?? access.url,
      environmentName: options?.environmentName ?? environment?.name ?? null,
      environmentColor: options?.environmentColor ?? environment?.color ?? null
    })
    return
  }

  if (access.type !== 'database' || !sessionKindForEngine(access.engine)) {
    throw new Error('Este engine não abre sessão SQL no North')
  }

  const store = useSessionsStore.getState()
  const tempId = crypto.randomUUID()
  const title = options?.title?.trim() || access.name
  store.beginConnectingTab({
    id: tempId,
    accessId,
    title,
    protocol: access.engine ?? undefined,
    sessionKind: 'database',
    username: options?.username ?? access.username,
    host: options?.host ?? access.host,
    environmentName: options?.environmentName ?? null,
    environmentColor: options?.environmentColor ?? null
  })

  if (!options?.environmentName) {
    void resolveAccessEnvironment(access.groupId).then((resolved) => {
      if (!resolved) return
      useSessionsStore.setState((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.id === tempId
            ? {
                ...tab,
                environmentName: resolved.name,
                environmentColor: resolved.color
              }
            : tab
        )
      }))
    })
  }

  try {
    const session = await window.north.sessions.openAccess(accessId)
    store.attachSessionPort({ tempId, session, port: null })
  } catch (error) {
    const message = formatIpcError(error, 'Falha ao conectar')
    store.failConnectingTab(tempId, message)
    throw error
  }
}

export function openApiStudioTab(input: {
  collectionId?: string | null
  collectionName?: string
  environmentAccessId?: string | null
  clientId?: string | null
  title?: string
  host?: string | null
  environmentName?: string | null
  environmentColor?: string | null
}): void {
  const store = useSessionsStore.getState()
  if (input.collectionId) {
    const existing = store.tabs.find(
      (tab) => tab.sessionKind === 'api' && tab.collectionId === input.collectionId
    )
    if (existing) {
      store.setActiveTab(existing.id)
      if (input.environmentAccessId && existing.environmentAccessId !== input.environmentAccessId) {
        useSessionsStore.setState((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === existing.id
              ? {
                  ...tab,
                  environmentAccessId: input.environmentAccessId,
                  accessId: input.environmentAccessId
                }
              : tab
          )
        }))
      }
      return
    }
  }

  const id = crypto.randomUUID()
  const tab: SessionTab = {
    id,
    kind: 'session',
    title: input.title?.trim() || input.collectionName || 'API',
    sessionKind: 'api',
    protocol: 'api',
    state: 'connected',
    accessId: input.environmentAccessId ?? null,
    collectionId: input.collectionId ?? null,
    environmentAccessId: input.environmentAccessId ?? null,
    clientId: input.clientId ?? null,
    host: input.host ?? null,
    environmentName: input.environmentName ?? null,
    environmentColor: input.environmentColor ?? null
  }
  useSessionsStore.setState((state) => ({
    tabs: [...state.tabs, tab],
    activeTabId: id
  }))
}

async function resolveAccessEnvironment(
  groupId: string
): Promise<{ name: string; color: string | null } | null> {
  const group = await window.north.groups.get(groupId)
  if (!group) return null
  const environment = await window.north.environments.get(group.environmentId)
  if (!environment) return null
  return { name: environment.name, color: environment.color }
}
