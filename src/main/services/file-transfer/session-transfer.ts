import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import { basename, join, posix } from 'node:path'
import { type AppLocale, IpcChannels } from '@shared/ipc'
import { isSafePosixAbsolute } from '@shared/lib/selection-path'
import type {
  SessionDownloadInput,
  SessionTransferResult,
  SessionUploadInput
} from '@shared/lib/session-shell'
import { canonicalPosixDir } from '@shared/lib/startup-directory'
import type { TerminalShellCapability, TransferProgress } from '@shared/protocols'
import { app, BrowserWindow, dialog } from 'electron'
import { readAppLocale } from '../../window-prefs'
import { requireAbsolute } from './local-fs'
import { startTrackedTransfer } from './tracked-transfer'
import { planDownload, planUpload } from './transfer-runner'

const DOWNLOAD_TITLE: Record<AppLocale, string> = {
  'pt-BR': 'Escolher pasta para baixar',
  en: 'Choose a folder to download',
  es: 'Elegir carpeta para descargar'
}

const UPLOAD_TITLE: Record<AppLocale, string> = {
  'pt-BR': 'Enviar arquivos',
  en: 'Upload files',
  es: 'Enviar archivos'
}

const FAILURE: Record<AppLocale, string> = {
  'pt-BR': 'Não foi possível alterar esta pasta.',
  en: 'Could not change this folder.',
  es: 'No se pudo modificar esta carpeta.'
}

type HeldDownload = { token: string; directory: string }
type HeldUpload = { token: string; localPaths: string[]; cwd: string }

const heldDownloads = new Map<string, HeldDownload>()
const heldUploads = new Map<string, HeldUpload>()

function locale(): AppLocale {
  return readAppLocale(app.getPath('userData'))
}

function parentWindow(sender: Electron.WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(sender)
}

function emitProgress(progress: TransferProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.FS_PROGRESS, progress)
  }
}

async function localClashes(directory: string, names: string[]): Promise<string[]> {
  const found: string[] = []
  for (const name of names) {
    try {
      await access(join(directory, name))
      found.push(name)
    } catch {
      // The name is free.
    }
  }
  return found
}

function safeRemote(path: string): string | null {
  if (!isSafePosixAbsolute(path)) return null
  const canonical = canonicalPosixDir(path)
  return isSafePosixAbsolute(canonical) ? canonical : null
}

function localName(path: string): string | null {
  const name = basename(path)
  if (name.length === 0 || name === '.' || name === '..') return null
  if (name.includes('/') || name.includes('\\')) return null
  return name
}

export async function downloadFromSession(
  shell: TerminalShellCapability,
  sender: Electron.WebContents,
  input: SessionDownloadInput
): Promise<SessionTransferResult> {
  const remotePath = safeRemote(input.remotePath)
  if (remotePath == null) return { ok: false, reason: 'invalid' }

  let held = input.destinationToken ? heldDownloads.get(input.sessionId) : undefined
  if (input.destinationToken && (!held || held.token !== input.destinationToken)) {
    return { ok: false, reason: 'cancelled' }
  }

  if (!held) {
    const win = parentWindow(sender)
    const options = {
      title: DOWNLOAD_TITLE[locale()],
      properties: ['openDirectory', 'createDirectory'] as 'openDirectory'[]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return { ok: false, reason: 'cancelled' }
    let directory: string
    try {
      directory = requireAbsolute(result.filePaths[0])
    } catch {
      return { ok: false, reason: 'invalid' }
    }
    held = { token: randomUUID(), directory }
    heldDownloads.set(input.sessionId, held)
  }

  const name = posix.basename(remotePath) || 'root'
  const clashes = input.conflict == null ? await localClashes(held.directory, [name]) : []
  if (clashes.length > 0) {
    return { ok: false, reason: 'conflict', names: clashes, destinationToken: held.token }
  }

  const opened = await shell.openFileTransfer()
  if (!opened.ok) return opened
  const localPath = join(held.directory, name)
  const handle = startTrackedTransfer(opened.transfer, {
    sessionId: input.sessionId,
    conflict: input.conflict,
    direction: 'download',
    remotePath,
    localPath,
    plan: () => planDownload(opened.transfer, remotePath, localPath, input.isDir),
    onProgress: emitProgress,
    onSettled: () => opened.close(),
    exposeError: false,
    fallbackError: FAILURE[locale()]
  })
  return { ok: true, transferId: handle.transferId, destinationToken: held.token }
}

export async function uploadToSession(
  shell: TerminalShellCapability,
  sender: Electron.WebContents,
  input: SessionUploadInput
): Promise<SessionTransferResult> {
  const cwd = shell.currentDirectory()
  if (cwd == null || !isSafePosixAbsolute(cwd)) return { ok: false, reason: 'unavailable' }

  let held = input.destinationToken ? heldUploads.get(input.sessionId) : undefined
  if (input.destinationToken && (!held || held.token !== input.destinationToken)) {
    return { ok: false, reason: 'cancelled' }
  }

  let localPaths = held?.localPaths
  if (!localPaths) {
    if (input.localPaths && input.localPaths.length > 0) {
      localPaths = []
      for (const path of input.localPaths) {
        try {
          localPaths.push(requireAbsolute(path))
        } catch {
          return { ok: false, reason: 'invalid' }
        }
      }
    } else {
      const win = parentWindow(sender)
      const options = {
        title: UPLOAD_TITLE[locale()],
        properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[]
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0)
        return { ok: false, reason: 'cancelled' }
      localPaths = []
      for (const path of result.filePaths) {
        try {
          localPaths.push(requireAbsolute(path))
        } catch {
          return { ok: false, reason: 'invalid' }
        }
      }
    }
    held = { token: randomUUID(), localPaths, cwd }
    heldUploads.set(input.sessionId, held)
  }
  if (!held) return { ok: false, reason: 'unavailable' }

  const names: string[] = []
  for (const path of held.localPaths) {
    const name = localName(path)
    if (name == null) return { ok: false, reason: 'invalid' }
    names.push(name)
  }

  if (input.conflict == null) {
    const opened = await shell.openFileTransfer()
    if (!opened.ok) return opened
    try {
      const entries = await opened.transfer.list(held.cwd)
      const existing = new Set(entries.map((entry) => entry.name))
      const clashes = names.filter((name) => existing.has(name))
      if (clashes.length > 0) {
        return { ok: false, reason: 'conflict', names: clashes, destinationToken: held.token }
      }
    } catch {
      return { ok: false, reason: 'unavailable' }
    } finally {
      opened.close()
    }
  }

  const target = held.cwd
  const files = held.localPaths
  const opened = await shell.openFileTransfer()
  if (!opened.ok) return opened
  const firstName = names[0] ?? 'upload'
  const handle = startTrackedTransfer(opened.transfer, {
    sessionId: input.sessionId,
    conflict: input.conflict,
    direction: 'upload',
    remotePath: posix.join(target, firstName),
    localPath: files[0] ?? '',
    plan: async () => {
      const combined = {
        dirs: [] as string[],
        files: [] as { remote: string; local: string; size: number | null }[]
      }
      for (const path of files) {
        const name = localName(path)
        if (name == null) continue
        const one = await planUpload(path, posix.join(target, name))
        combined.dirs.push(...one.dirs)
        combined.files.push(...one.files)
      }
      return combined
    },
    onProgress: emitProgress,
    onSettled: () => opened.close(),
    exposeError: false,
    fallbackError: FAILURE[locale()]
  })
  return { ok: true, transferId: handle.transferId, destinationToken: held.token }
}

export function releaseSessionTransfers(sessionId: string): void {
  heldDownloads.delete(sessionId)
  heldUploads.delete(sessionId)
}
