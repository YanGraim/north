import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import type {
  FsDownloadInput,
  FsListInput,
  FsPathInput,
  FsRenameInput,
  FsUploadInput,
  TransferHandle,
  TransferProgress
} from '@shared/protocols'
import { BrowserWindow, dialog, ipcMain } from 'electron'
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
    await requireFileTransfer(input.sessionId).remove(input.path)
  })

  ipcMain.handle(
    IpcChannels.FS_DOWNLOAD,
    async (event, input: FsDownloadInput): Promise<TransferHandle> => {
      const ft = requireFileTransfer(input.sessionId)
      const transferId = randomUUID()
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = win
        ? await dialog.showSaveDialog(win, {
            defaultPath: basename(input.remotePath),
            title: 'Salvar arquivo'
          })
        : await dialog.showSaveDialog({
            defaultPath: basename(input.remotePath),
            title: 'Salvar arquivo'
          })

      if (result.canceled || !result.filePath) {
        throw new Error('Download cancelado')
      }

      const localPath = result.filePath
      void ft
        .download(input.remotePath, localPath, (bytesTransferred, totalBytes) => {
          emitProgress({
            transferId,
            sessionId: input.sessionId,
            direction: 'download',
            remotePath: input.remotePath,
            bytesTransferred,
            totalBytes,
            done: false
          })
        })
        .then(() => {
          emitProgress({
            transferId,
            sessionId: input.sessionId,
            direction: 'download',
            remotePath: input.remotePath,
            bytesTransferred: 0,
            totalBytes: null,
            done: true
          })
        })
        .catch((error: unknown) => {
          emitProgress({
            transferId,
            sessionId: input.sessionId,
            direction: 'download',
            remotePath: input.remotePath,
            bytesTransferred: 0,
            totalBytes: null,
            done: true,
            error: error instanceof Error ? error.message : 'Falha no download'
          })
        })

      return { transferId }
    }
  )

  ipcMain.handle(
    IpcChannels.FS_UPLOAD,
    async (_event, input: FsUploadInput): Promise<TransferHandle> => {
      const ft = requireFileTransfer(input.sessionId)
      const transferId = randomUUID()

      void ft
        .upload(input.localPath, input.remotePath, (bytesTransferred, totalBytes) => {
          emitProgress({
            transferId,
            sessionId: input.sessionId,
            direction: 'upload',
            remotePath: input.remotePath,
            bytesTransferred,
            totalBytes,
            done: false
          })
        })
        .then(() => {
          emitProgress({
            transferId,
            sessionId: input.sessionId,
            direction: 'upload',
            remotePath: input.remotePath,
            bytesTransferred: 0,
            totalBytes: null,
            done: true
          })
        })
        .catch((error: unknown) => {
          emitProgress({
            transferId,
            sessionId: input.sessionId,
            direction: 'upload',
            remotePath: input.remotePath,
            bytesTransferred: 0,
            totalBytes: null,
            done: true,
            error: error instanceof Error ? error.message : 'Falha no upload'
          })
        })

      return { transferId }
    }
  )
}
