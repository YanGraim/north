import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import {
  type FileTransferCapability,
  type FsCancelInput,
  FsCancelInputSchema,
  type FsDownloadInput,
  FsDownloadInputSchema,
  type FsListInput,
  type FsPathInput,
  type FsRenameInput,
  type FsUploadInput,
  FsUploadInputSchema,
  type LocalFsPathInput,
  LocalFsPathInputSchema,
  type LocalFsRenameInput,
  LocalFsRenameInputSchema,
  type TransferConflict,
  type TransferHandle,
  type TransferProgress
} from '@shared/protocols'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import {
  listLocal,
  localFsInfo,
  mkdirLocal,
  renameLocal,
  requireAbsolute
} from '../services/file-transfer/local-fs'
import {
  planDownload,
  planUpload,
  runTransfer,
  TransferCancelledError,
  type TransferPlan
} from '../services/file-transfer/transfer-runner'
import { getProtocolManager } from './sessions'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

function requireFileTransfer(sessionId: string) {
  const session = getProtocolManager().getActiveSession(sessionId)
  if (!session) {
    throw new Error('Sessão não encontrada')
  }
  if (!session.fileTransfer) {
    throw new Error('Esta sessão não suporte transferência de arquivos')
  }
  if (session.state !== 'connected') {
    throw new Error('Sessão não está conectada')
  }
  return session.fileTransfer
}

function emitProgress(progress: TransferProgress): void {
  broadcast(IpcChannels.FS_PROGRESS, progress)
}

export function registerFsHandlers(): void {
  ipcMain.handle(IpcChannels.FS_LIST, async (_event, input: FsListInput) => {
    return requireFileTransfer(input.sessionId).list(input.path)
  })

  ipcMain.handle(IpcChannels.FS_MKDIR, async (_event, input: FsPathInput) => {
    await requireFileTransfer(input.sessionId).mkdir(input.path)
  })

  ipcMain.handle(IpcChannels.FS_RENAME, async (_event, input: FsRenameInput) => {
    await requireFileTransfer(input.sessionId).rename(input.from, input.to)
  })

  ipcMain.handle(IpcChannels.FS_DELETE, async (_event, input: FsPathInput) => {
    await removeRemote(requireFileTransfer(input.sessionId), input.path)
  })

  ipcMain.handle(
    IpcChannels.FS_DOWNLOAD,
    async (event, raw: FsDownloadInput): Promise<TransferHandle> => {
      const input = FsDownloadInputSchema.parse(raw)
      const ft = requireFileTransfer(input.sessionId)
      let localPath = input.localPath
      if (!localPath) {
        const win = BrowserWindow.fromWebContents(event.sender)
        const options = { defaultPath: basename(input.remotePath), title: 'Salvar arquivo' }
        const result = win
          ? await dialog.showSaveDialog(win, options)
          : await dialog.showSaveDialog(options)
        if (result.canceled || !result.filePath) {
          throw new Error('Download cancelado')
        }
        localPath = result.filePath
      }
      requireAbsolute(localPath)
      const isDir = input.isDir ?? false
      return startTransfer(ft, {
        sessionId: input.sessionId,
        conflict: input.conflict,
        direction: 'download',
        remotePath: input.remotePath,
        localPath,
        plan: () => planDownload(ft, input.remotePath, localPath, isDir)
      })
    }
  )

  ipcMain.handle(
    IpcChannels.FS_UPLOAD,
    async (_event, raw: FsUploadInput): Promise<TransferHandle> => {
      const input = FsUploadInputSchema.parse(raw)
      const ft = requireFileTransfer(input.sessionId)
      requireAbsolute(input.localPath)
      return startTransfer(ft, {
        sessionId: input.sessionId,
        conflict: input.conflict,
        direction: 'upload',
        remotePath: input.remotePath,
        localPath: input.localPath,
        plan: () => planUpload(input.localPath, input.remotePath)
      })
    }
  )

  ipcMain.handle(IpcChannels.FS_HOME, async (_event, sessionId: string) => {
    const ft = requireFileTransfer(sessionId)
    return (await ft.home?.().catch(() => null)) || '/'
  })

  ipcMain.handle(IpcChannels.FS_CANCEL, async (_event, raw: FsCancelInput) => {
    const input = FsCancelInputSchema.parse(raw)
    activeTransfers.get(input.transferId)?.abort()
  })
}

/** Deletes a file or a folder with its contents (rmdir alone refuses non-empty folders). */
async function removeRemote(ft: FileTransferCapability, path: string): Promise<void> {
  try {
    await ft.remove(path)
    return
  } catch (error) {
    let children: Awaited<ReturnType<FileTransferCapability['list']>>
    try {
      children = await ft.list(path)
    } catch {
      throw error
    }
    for (const child of children) {
      if (child.name === '.' || child.name === '..') continue
      await removeRemote(ft, child.path)
    }
    await ft.remove(path)
  }
}

const activeTransfers = new Map<string, AbortController>()

function startTransfer(
  ft: FileTransferCapability,
  opts: {
    sessionId: string
    conflict?: TransferConflict
    direction: 'download' | 'upload'
    remotePath: string
    localPath: string
    plan: () => Promise<TransferPlan>
  }
): TransferHandle {
  const transferId = randomUUID()
  const controller = new AbortController()
  activeTransfers.set(transferId, controller)
  const base = {
    transferId,
    sessionId: opts.sessionId,
    direction: opts.direction,
    remotePath: opts.remotePath,
    localPath: opts.localPath
  }
  const fallbackError = opts.direction === 'download' ? 'Falha no download' : 'Falha no upload'

  void (async () => {
    try {
      const plan = await opts.plan()
      await runTransfer({
        ft,
        direction: opts.direction,
        plan,
        conflict: opts.conflict,
        signal: controller.signal,
        onProgress: (update) => emitProgress({ ...base, ...update, done: false })
      })
      emitProgress({ ...base, bytesTransferred: 0, totalBytes: null, done: true })
    } catch (error) {
      const cancelled = error instanceof TransferCancelledError
      emitProgress({
        ...base,
        bytesTransferred: 0,
        totalBytes: null,
        done: true,
        cancelled,
        error: cancelled ? null : error instanceof Error ? error.message : fallbackError
      })
    } finally {
      activeTransfers.delete(transferId)
    }
  })()

  return { transferId }
}

export function registerLocalFsHandlers(): void {
  ipcMain.handle(IpcChannels.LOCAL_FS_INFO, () => localFsInfo())

  ipcMain.handle(IpcChannels.LOCAL_FS_LIST, async (_event, raw: LocalFsPathInput) => {
    return listLocal(LocalFsPathInputSchema.parse(raw).path)
  })

  ipcMain.handle(IpcChannels.LOCAL_FS_MKDIR, async (_event, raw: LocalFsPathInput) => {
    await mkdirLocal(LocalFsPathInputSchema.parse(raw).path)
  })

  ipcMain.handle(IpcChannels.LOCAL_FS_RENAME, async (_event, raw: LocalFsRenameInput) => {
    const input = LocalFsRenameInputSchema.parse(raw)
    await renameLocal(input.from, input.to)
  })

  // Local deletes go to the OS trash — a misclick in the left pane must stay recoverable.
  ipcMain.handle(IpcChannels.LOCAL_FS_DELETE, async (_event, raw: LocalFsPathInput) => {
    await shell.trashItem(requireAbsolute(LocalFsPathInputSchema.parse(raw).path))
  })

  ipcMain.handle(IpcChannels.LOCAL_FS_OPEN, async (_event, raw: LocalFsPathInput) => {
    const message = await shell.openPath(requireAbsolute(LocalFsPathInputSchema.parse(raw).path))
    if (message) throw new Error(message)
  })
}
