import { IpcChannels, type NorthApi } from '@shared/ipc'
import type {
  FsDownloadInput,
  FsListInput,
  FsPathInput,
  FsRenameInput,
  FsUploadInput,
  HostKeyPrompt,
  HostKeyResponse,
  SessionDescriptor,
  SessionPortMessage,
  TransferProgress
} from '@shared/protocols'
import type { UpdateStatus } from '@shared/types'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

function openSession(
  connectionId: string,
  onPort: (port: MessagePort) => void
): Promise<SessionDescriptor> {
  const requestId = crypto.randomUUID()

  const portPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ipcRenderer.removeListener(IpcChannels.SESSIONS_PORT, onPortMessage)
      reject(new Error('Timeout waiting for session MessagePort'))
    }, 60_000)

    function onPortMessage(event: Electron.IpcRendererEvent, payload: { requestId: string }): void {
      if (payload.requestId !== requestId) return
      clearTimeout(timeout)
      ipcRenderer.removeListener(IpcChannels.SESSIONS_PORT, onPortMessage)
      const port = event.ports[0]
      if (!port) {
        reject(new Error('Session MessagePort missing'))
        return
      }
      // Deliver as callback argument so contextBridge transfers a live MessagePort.
      onPort(port)
      resolve()
    }

    ipcRenderer.on(IpcChannels.SESSIONS_PORT, onPortMessage)
  })

  return Promise.all([
    ipcRenderer.invoke(
      IpcChannels.SESSIONS_OPEN,
      connectionId,
      requestId
    ) as Promise<SessionDescriptor>,
    portPromise
  ]).then(([session]) => session)
}

const api: NorthApi = {
  getVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.APP_GET_VERSION),

  clients: {
    list: () => ipcRenderer.invoke(IpcChannels.CLIENTS_LIST),
    get: (id) => ipcRenderer.invoke(IpcChannels.CLIENTS_GET, id),
    create: (input) => ipcRenderer.invoke(IpcChannels.CLIENTS_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IpcChannels.CLIENTS_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IpcChannels.CLIENTS_DELETE, id)
  },

  environments: {
    list: (clientId) => ipcRenderer.invoke(IpcChannels.ENVIRONMENTS_LIST, clientId),
    get: (id) => ipcRenderer.invoke(IpcChannels.ENVIRONMENTS_GET, id),
    create: (input) => ipcRenderer.invoke(IpcChannels.ENVIRONMENTS_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IpcChannels.ENVIRONMENTS_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IpcChannels.ENVIRONMENTS_DELETE, id)
  },

  groups: {
    list: (environmentId) => ipcRenderer.invoke(IpcChannels.GROUPS_LIST, environmentId),
    get: (id) => ipcRenderer.invoke(IpcChannels.GROUPS_GET, id),
    create: (input) => ipcRenderer.invoke(IpcChannels.GROUPS_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IpcChannels.GROUPS_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IpcChannels.GROUPS_DELETE, id)
  },

  connections: {
    list: (filter) => ipcRenderer.invoke(IpcChannels.CONNECTIONS_LIST, filter),
    get: (id) => ipcRenderer.invoke(IpcChannels.CONNECTIONS_GET, id),
    create: (input) => ipcRenderer.invoke(IpcChannels.CONNECTIONS_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IpcChannels.CONNECTIONS_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IpcChannels.CONNECTIONS_DELETE, id),
    toggleFavorite: (id) => ipcRenderer.invoke(IpcChannels.CONNECTIONS_TOGGLE_FAVORITE, id),
    duplicate: (id) => ipcRenderer.invoke(IpcChannels.CONNECTIONS_DUPLICATE, id)
  },

  accesses: {
    list: (filter) => ipcRenderer.invoke(IpcChannels.ACCESSES_LIST, filter),
    get: (id) => ipcRenderer.invoke(IpcChannels.ACCESSES_GET, id),
    create: (input) => ipcRenderer.invoke(IpcChannels.ACCESSES_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IpcChannels.ACCESSES_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IpcChannels.ACCESSES_DELETE, id),
    toggleFavorite: (id) => ipcRenderer.invoke(IpcChannels.ACCESSES_TOGGLE_FAVORITE, id)
  },

  tags: {
    list: () => ipcRenderer.invoke(IpcChannels.TAGS_LIST),
    create: (input) => ipcRenderer.invoke(IpcChannels.TAGS_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IpcChannels.TAGS_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IpcChannels.TAGS_DELETE, id),
    setForConnection: (input) => ipcRenderer.invoke(IpcChannels.TAGS_SET_FOR_CONNECTION, input),
    listForConnection: (connectionId) =>
      ipcRenderer.invoke(IpcChannels.TAGS_LIST_FOR_CONNECTION, connectionId),
    setForAccess: (input) => ipcRenderer.invoke(IpcChannels.TAGS_SET_FOR_ACCESS, input),
    listForAccess: (accessId) => ipcRenderer.invoke(IpcChannels.TAGS_LIST_FOR_ACCESS, accessId)
  },

  history: {
    list: (filter) => ipcRenderer.invoke(IpcChannels.HISTORY_LIST, filter),
    record: (input) => ipcRenderer.invoke(IpcChannels.HISTORY_RECORD, input)
  },

  search: {
    index: () => ipcRenderer.invoke(IpcChannels.SEARCH_INDEX)
  },

  vault: {
    setSecret: (input) => ipcRenderer.invoke(IpcChannels.VAULT_SET_SECRET, input),
    deleteSecret: (credentialRef) =>
      ipcRenderer.invoke(IpcChannels.VAULT_DELETE_SECRET, credentialRef),
    hasSecret: (credentialRef) => ipcRenderer.invoke(IpcChannels.VAULT_HAS_SECRET, credentialRef),
    isAvailable: () => ipcRenderer.invoke(IpcChannels.VAULT_IS_AVAILABLE),
    revealSecret: (input) => ipcRenderer.invoke(IpcChannels.VAULT_REVEAL_SECRET, input)
  },

  sessions: {
    open: openSession,
    close: (sessionId) => ipcRenderer.invoke(IpcChannels.SESSIONS_CLOSE, sessionId),
    list: () => ipcRenderer.invoke(IpcChannels.SESSIONS_LIST),
    respondHostKey: (response: HostKeyResponse) =>
      ipcRenderer.invoke(IpcChannels.SESSIONS_RESPOND_HOST_KEY, response),
    write: (sessionId, data) => {
      ipcRenderer.send(IpcChannels.SESSIONS_STDIN, sessionId, data)
    },
    resize: (sessionId, cols, rows) => {
      ipcRenderer.send(IpcChannels.SESSIONS_RESIZE, sessionId, cols, rows)
    },
    ready: (sessionId) => {
      ipcRenderer.send(IpcChannels.SESSIONS_STDOUT_READY, sessionId)
    },
    onStdout: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { sessionId: string; message: SessionPortMessage }
      ): void => {
        listener(payload)
      }
      ipcRenderer.on(IpcChannels.SESSIONS_STDOUT, handler)
      return () => ipcRenderer.removeListener(IpcChannels.SESSIONS_STDOUT, handler)
    },
    onStateChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, session: SessionDescriptor): void => {
        listener(session)
      }
      ipcRenderer.on(IpcChannels.SESSIONS_STATE_CHANGED, handler)
      return () => ipcRenderer.removeListener(IpcChannels.SESSIONS_STATE_CHANGED, handler)
    },
    onHostKeyPrompt: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, prompt: HostKeyPrompt): void => {
        listener(prompt)
      }
      ipcRenderer.on(IpcChannels.SESSIONS_HOST_KEY_PROMPT, handler)
      return () => ipcRenderer.removeListener(IpcChannels.SESSIONS_HOST_KEY_PROMPT, handler)
    }
  },

  fs: {
    list: (input: FsListInput) => ipcRenderer.invoke(IpcChannels.FS_LIST, input),
    mkdir: (input: FsPathInput) => ipcRenderer.invoke(IpcChannels.FS_MKDIR, input),
    rename: (input: FsRenameInput) => ipcRenderer.invoke(IpcChannels.FS_RENAME, input),
    delete: (input: FsPathInput) => ipcRenderer.invoke(IpcChannels.FS_DELETE, input),
    download: (input: FsDownloadInput) => ipcRenderer.invoke(IpcChannels.FS_DOWNLOAD, input),
    upload: (input: FsUploadInput) => ipcRenderer.invoke(IpcChannels.FS_UPLOAD, input),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: TransferProgress): void => {
        listener(progress)
      }
      ipcRenderer.on(IpcChannels.FS_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IpcChannels.FS_PROGRESS, handler)
    },
    getPathForFile: (file: File) => webUtils.getPathForFile(file)
  },

  serial: {
    listPorts: () => ipcRenderer.invoke(IpcChannels.SERIAL_LIST_PORTS)
  },

  stats: {
    overview: () => ipcRenderer.invoke(IpcChannels.STATS_OVERVIEW)
  },

  inventory: {
    export: () => ipcRenderer.invoke(IpcChannels.INVENTORY_EXPORT),
    import: () => ipcRenderer.invoke(IpcChannels.INVENTORY_IMPORT),
    importCsv: (options: { allowSecrets: boolean }) =>
      ipcRenderer.invoke(IpcChannels.INVENTORY_IMPORT_CSV, options),
    downloadCsvTemplate: () => ipcRenderer.invoke(IpcChannels.INVENTORY_DOWNLOAD_CSV_TEMPLATE)
  },

  updates: {
    check: () => ipcRenderer.invoke(IpcChannels.UPDATES_CHECK),
    getStatus: () => ipcRenderer.invoke(IpcChannels.UPDATES_GET_STATUS),
    install: () => ipcRenderer.invoke(IpcChannels.UPDATES_INSTALL),
    onAvailable: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { version: string }): void => {
        listener(info)
      }
      ipcRenderer.on(IpcChannels.UPDATES_AVAILABLE, handler)
      return () => ipcRenderer.removeListener(IpcChannels.UPDATES_AVAILABLE, handler)
    },
    onStatusChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => {
        listener(status)
      }
      ipcRenderer.on(IpcChannels.UPDATES_STATUS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IpcChannels.UPDATES_STATUS_CHANGED, handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('north', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error fallback when contextIsolation is disabled
  window.north = api
}
