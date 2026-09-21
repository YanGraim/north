import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import { app, ipcMain } from 'electron'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp'
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    IpcChannels.TERMINAL_PASTE_IMAGE,
    async (_event, bytes: unknown, mimeType: unknown) => {
      if (!(bytes instanceof Uint8Array)) throw new Error('Invalid image bytes')
      const ext = EXTENSION_BY_MIME[String(mimeType)] ?? 'png'
      const path = join(app.getPath('temp'), `north-paste-${randomUUID()}.${ext}`)
      await writeFile(path, bytes)
      return path
    }
  )
}
