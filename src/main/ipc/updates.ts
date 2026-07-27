import { IpcChannels } from '@shared/ipc'
import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

let configured = false

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

function ensureConfigured(): void {
  if (configured) return
  configured = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    broadcast(IpcChannels.UPDATES_AVAILABLE, { version: info.version })
  })
}

export function registerUpdateHandlers(): void {
  ipcMain.handle(IpcChannels.UPDATES_CHECK, async () => {
    if (!app.isPackaged && !process.env.NORTH_ENABLE_UPDATES) {
      return { available: false, version: null }
    }

    ensureConfigured()
    try {
      const result = await autoUpdater.checkForUpdates()
      const version = result?.updateInfo?.version ?? null
      return {
        available: Boolean(version && version !== app.getVersion()),
        version
      }
    } catch {
      return { available: false, version: null }
    }
  })

  ipcMain.handle(IpcChannels.UPDATES_INSTALL, async () => {
    ensureConfigured()
    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
  })
}
