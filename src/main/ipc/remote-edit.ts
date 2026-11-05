import { IpcChannels } from '@shared/ipc'
import {
  type FsEditCloseInput,
  FsEditCloseInputSchema,
  type FsEditOpenInput,
  FsEditOpenInputSchema,
  type FsEditSaveInput,
  FsEditSaveInputSchema,
  type SaveExternalEditorsInput,
  SaveExternalEditorsInputSchema
} from '@shared/lib/remote-edit'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readExternalEditors, saveExternalEditors } from '../external-editors'
import {
  closeRemoteEdit,
  configureRemoteEdits,
  openRemoteEdit,
  saveRemoteEdit
} from '../services/file-transfer/remote-edit-service'
import { getProtocolManager } from './sessions'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

function fileTransferOf(sessionId: string) {
  try {
    const session = getProtocolManager().getActiveSession(sessionId)
    if (!session?.fileTransfer || session.state !== 'connected') return null
    return session.fileTransfer
  } catch {
    return null
  }
}

export function registerRemoteEditHandlers(): void {
  configureRemoteEdits({
    lookup: fileTransferOf,
    uploaded: (notice) => broadcast(IpcChannels.FS_EDIT_UPLOADED, notice),
    failed: (notice) => broadcast(IpcChannels.FS_EDIT_FAILED, notice)
  })

  ipcMain.handle(IpcChannels.FS_EDIT_OPEN, async (_event, raw: FsEditOpenInput) => {
    const parsed = FsEditOpenInputSchema.safeParse(raw)
    if (!parsed.success) return { ok: false as const, reason: 'unavailable' as const }
    const transfer = fileTransferOf(parsed.data.sessionId)
    if (!transfer) return { ok: false as const, reason: 'unavailable' as const }
    return openRemoteEdit({
      ...parsed.data,
      editors: readExternalEditors(app.getPath('userData')),
      transfer
    })
  })

  ipcMain.handle(IpcChannels.FS_EDIT_SAVE, async (_event, raw: FsEditSaveInput) => {
    const parsed = FsEditSaveInputSchema.safeParse(raw)
    if (!parsed.success) return { ok: false as const, reason: 'unavailable' as const }
    return saveRemoteEdit(parsed.data)
  })

  ipcMain.handle(IpcChannels.FS_EDIT_CLOSE, async (_event, raw: FsEditCloseInput) => {
    const parsed = FsEditCloseInputSchema.safeParse(raw)
    if (!parsed.success) return
    await closeRemoteEdit(parsed.data.sessionId, parsed.data.editId)
  })

  ipcMain.handle(IpcChannels.SETTINGS_LIST_EXTERNAL_EDITORS, () => {
    return { editors: readExternalEditors(app.getPath('userData')) }
  })

  ipcMain.handle(
    IpcChannels.SETTINGS_SAVE_EXTERNAL_EDITORS,
    (_event, raw: SaveExternalEditorsInput) => {
      const parsed = SaveExternalEditorsInputSchema.safeParse(raw)
      if (!parsed.success) return { ok: false as const, reason: 'invalid' as const }
      return saveExternalEditors(app.getPath('userData'), parsed.data.editors)
    }
  )

  ipcMain.handle(IpcChannels.SETTINGS_PICK_EXECUTABLE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = { properties: ['openFile' as const] }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })
}
