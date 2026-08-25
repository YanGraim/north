import { IpcChannels } from '@shared/ipc'
import { isNewerVersion } from '@shared/lib/semver'
import type { UpdateStatus } from '@shared/types'
import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { stripQuarantine } from '../lib/strip-quarantine'

const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000
const QUIT_TIMEOUT_MS = 12_000
const STARTUP_CHECK_DELAY_MS = 8_000

let configured = false
let lastDownloadedUpdatePath: string | null = null

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

function isRunningFromDmgVolume(): boolean {
  return process.platform === 'darwin' && process.execPath.startsWith('/Volumes/')
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
  if (
    /code signature|codesign|gatekeeper|signature|SQRLCodeSignature|did not pass validation/i.test(
      message
    )
  ) {
    return (
      'Falha na verificação da atualização no Mac. O release no GitHub precisa estar publicado ' +
      '(rascunho não conta). Se esta cópia ainda for anterior à assinatura estável, instale o .dmg desta versão uma vez.'
    )
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
    if (!isNewerVersion(info.version, app.getVersion())) {
      patchState({
        checking: false,
        available: false,
        version: null,
        downloaded: false,
        downloading: false,
        progress: null
      })
      return
    }

    patchState({
      checking: false,
      available: true,
      version: info.version,
      downloaded: false,
      downloading: true,
      progress: 0,
      error: null
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
    if (!state.available) return
    patchState({
      downloading: true,
      progress: progress.percent
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    if (!isNewerVersion(info.version, app.getVersion())) {
      patchState({
        available: false,
        version: null,
        downloaded: false,
        downloading: false,
        progress: null
      })
      return
    }

    const downloadedFile = info.downloadedFile
    if (downloadedFile) {
      lastDownloadedUpdatePath = downloadedFile
      void stripQuarantine(downloadedFile)
    }

    patchState({
      checking: false,
      available: true,
      version: info.version,
      downloaded: true,
      downloading: false,
      progress: 100,
      error: null
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
    const available = Boolean(remoteVersion && isNewerVersion(remoteVersion, app.getVersion()))

    if (!available) {
      // Não inventar "baixando 0%" quando a latest remota é igual ou mais antiga.
      patchState({
        checking: false,
        available: false,
        version: null,
        downloaded: false,
        downloading: false,
        progress: null
      })
    } else {
      // Download real é sinalizado pelos eventos update-available / download-progress.
      patchState({
        checking: false,
        available: true,
        version: remoteVersion,
        error: null
      })
    }

    return getStatus()
  } catch (error: unknown) {
    patchState({
      checking: false,
      downloading: false,
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

  if (isRunningFromDmgVolume()) {
    throw new Error(
      'O North está rodando a partir de um volume (DMG). Copie o app para /Applications e abra de lá antes de instalar atualizações.'
    )
  }

  ensureConfigured()

  if (!state.available && !state.downloaded) {
    throw new Error('Nenhuma atualização disponível para instalar.')
  }

  if (state.version && !isNewerVersion(state.version, app.getVersion())) {
    throw new Error('A versão remota não é mais recente que a instalada.')
  }

  if (!state.downloaded) {
    patchState({ downloading: true, error: null, progress: state.progress ?? 0 })

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

  if (lastDownloadedUpdatePath) {
    await stripQuarantine(lastDownloadedUpdatePath)
  }

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
