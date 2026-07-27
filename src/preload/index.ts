import { IpcChannels, type NorthApi } from '@shared/ipc'
import { contextBridge, ipcRenderer } from 'electron'

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

  tags: {
    list: () => ipcRenderer.invoke(IpcChannels.TAGS_LIST),
    create: (input) => ipcRenderer.invoke(IpcChannels.TAGS_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IpcChannels.TAGS_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IpcChannels.TAGS_DELETE, id),
    setForConnection: (input) => ipcRenderer.invoke(IpcChannels.TAGS_SET_FOR_CONNECTION, input),
    listForConnection: (connectionId) =>
      ipcRenderer.invoke(IpcChannels.TAGS_LIST_FOR_CONNECTION, connectionId)
  },

  history: {
    list: (filter) => ipcRenderer.invoke(IpcChannels.HISTORY_LIST, filter),
    record: (input) => ipcRenderer.invoke(IpcChannels.HISTORY_RECORD, input)
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
