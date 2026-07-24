import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type NorthApi } from '@shared/ipc'

const api: NorthApi = {
  getVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.APP_GET_VERSION)
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
