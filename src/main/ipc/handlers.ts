import { app, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.APP_GET_VERSION, (): string => {
    return app.getVersion()
  })
}
