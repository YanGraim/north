import { IpcChannels } from '@shared/ipc'
import type { UpdateStatus } from '@shared/types'
import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000
const QUIT_TIMEOUT_MS = 12_000
const STARTUP_CHECK_DELAY_MS = 8_000

let configured = false

const disabledStatus = (): UpdateStatus => ({
  enabled: false,
  checking: false,
  available: false,
  version: null,
  downloaded: false,
  downloading: false,
  progress: null,
  error: null
})

let state: UpdateStatus = disabledStatus()

function isUpdatesEnabled(): boolean {
  return app.isPackaged || process.env.NORTH_ENABLE_UPDATES === '1'
}

function getStatus(): UpdateStatus {
  return { ...state, enabled: isUpdatesEnabled() }
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

function patchState(patch: Partial<UpdateStatus>): void {
  state = { ...state, ...patch }
  broadcast(IpcChannels.UPDATES_STATUS_CHANGED, getStatus())
}

function normalizeUpdateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/404|not found|latest/i.test(message)) {
    return 'Não foi possível acessar as releases. Verifique se o repositório é público e sua conexão.'
  }
  return message || 'Falha ao verificar atualizações'
}

function ensureConfigured(): void {
  if (configured) return
  configured = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    patchState({ checking: true, error: null })
  })

  autoUpdater.on('update-available', (info) => {
    patchState({
      checking: false,
      available: true,
      version: info.version,
      downloaded: false,
      downloading: true,
      progress: state.progress ?? 0
    })
    broadcast(IpcChannels.UPDATES_AVAILABLE, { version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    patchState({
      checking: false,
      available: false,
      version: null,
      downloaded: false,
      downloading: false,
      progress: null
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    patchState({
      downloading: true,
      progress: progress.percent
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    patchState({
      checking: false,
      available: true,
      version: info.version,
      downloaded: true,
      downloading: false,
      progress: 100
    })
  })

  autoUpdater.on('error', (error) => {
    patchState({
      checking: false,
      downloading: false,
      error: normalizeUpdateError(error)
    })
  })
}

async function runCheck(): Promise<UpdateStatus> {
  if (!isUpdatesEnabled()) {
    return disabledStatus()
  }

  ensureConfigured()
  patchState({ checking: true, error: null })

  try {
    const result = await autoUpdater.checkForUpdates()
    const remoteVersion = result?.updateInfo?.version ?? null
    const available = Boolean(remoteVersion && remoteVersion !== app.getVersion())

    if (!available) {
      patchState({
        checking: false,
        available: false,
        version: null,
        downloaded: false,
        downloading: false,
        progress: null
      })
    } else if (!state.downloading && !state.downloaded) {
      patchState({
        checking: false,
        available: true,
        version: remoteVersion,
        downloading: true,
        progress: state.progress ?? 0
      })
    } else {
      patchState({ checking: false })
    }

    return getStatus()
  } catch (error: unknown) {
    patchState({
      checking: false,
      error: normalizeUpdateError(error)
    })
    return getStatus()
  }
}

function waitForDownloaded(timeoutMs: number): Promise<void> {
  if (state.downloaded) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('O download da atualização demorou demais. Tente novamente mais tarde.'))
    }, timeoutMs)

    const onDownloaded = (): void => {
      cleanup()
      resolve()
    }

    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }

    const cleanup = (): void => {
      clearTimeout(timer)
      autoUpdater.removeListener('update-downloaded', onDownloaded)
      autoUpdater.removeListener('error', onError)
    }

    autoUpdater.once('update-downloaded', onDownloaded)
    autoUpdater.once('error', onError)
  })
}

function waitForQuit(timeoutMs: number): Promise<void> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          'Não foi possível reiniciar automaticamente. Feche o North e abra de novo — a atualização pode já estar baixada.'
        )
      )
    }, timeoutMs)
  })
}

async function installUpdate(): Promise<void> {
  if (!isUpdatesEnabled()) {
    throw new Error('Atualizações desabilitadas neste ambiente.')
  }

  ensureConfigured()

  if (!state.available && !state.downloaded) {
    throw new Error('Nenhuma atualização disponível para instalar.')
  }

  if (!state.downloaded) {
    patchState({ downloading: true, error: null })

    try {
      await autoUpdater.downloadUpdate()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/downloading|already/i.test(message)) {
        throw error
      }
    }

    await waitForDownloaded(DOWNLOAD_TIMEOUT_MS)
  }

  patchState({ downloading: false })

  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
  })

  await waitForQuit(QUIT_TIMEOUT_MS)
}

function scheduleStartupUpdateCheck(): void {
  if (!isUpdatesEnabled()) return

  setTimeout(() => {
    void runCheck()
  }, STARTUP_CHECK_DELAY_MS)
}

export function registerUpdateHandlers(): void {
  ipcMain.handle(IpcChannels.UPDATES_CHECK, () => runCheck())

  ipcMain.handle(IpcChannels.UPDATES_GET_STATUS, () => getStatus())

  ipcMain.handle(IpcChannels.UPDATES_INSTALL, () => installUpdate())

  scheduleStartupUpdateCheck()
}
