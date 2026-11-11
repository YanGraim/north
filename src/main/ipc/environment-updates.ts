import { writeFile } from 'node:fs/promises'
import { IpcChannels } from '@shared/ipc'
import { IdSchema } from '@shared/types'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { WorkflowStore } from '../workspaces/workflow-store'

/** History of git-tracked runs; in an organization it is the team's, with who ran each (REC-024). */
export function registerEnvironmentUpdateHandlers(store: () => WorkflowStore): void {
  ipcMain.handle(
    IpcChannels.ENVIRONMENT_UPDATES_LIST,
    (_event, environmentId: unknown, limit?: unknown) => {
      const parsedLimit = limit === undefined ? undefined : Number(limit)
      return store().updates.listByEnvironment(IdSchema.parse(environmentId), parsedLimit)
    }
  )

  ipcMain.handle(IpcChannels.ENVIRONMENT_UPDATES_LIST_RECENT, (_event, limit?: unknown) => {
    const parsedLimit = limit === undefined ? undefined : Number(limit)
    return store().updates.listRecent(parsedLimit)
  })

  ipcMain.handle(
    IpcChannels.ENVIRONMENT_UPDATES_SAVE_RELEASE_NOTES,
    async (event, png: unknown, suggestedName: unknown) => {
      const bytes = parseReleaseNotesPng(png)
      const name = sanitizeFileName(typeof suggestedName === 'string' ? suggestedName : '')
      const options = {
        title: 'Salvar notas da versão',
        defaultPath: `${name || 'notas-da-versao'}.png`,
        filters: [{ name: 'Imagem PNG', extensions: ['png'] }]
      }
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { canceled: true, filePath: null }
      await writeFile(result.filePath, bytes)
      return { canceled: false, filePath: result.filePath }
    }
  )
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const MAX_PNG_BYTES = 30 * 1024 * 1024

/** The renderer only ever sends a PNG it drew; anything else is refused. */
export function parseReleaseNotesPng(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new Error('Imagem inválida.')
  if (value.byteLength > MAX_PNG_BYTES) throw new Error('Imagem grande demais.')
  if (!PNG_SIGNATURE.every((b, i) => value[i] === b)) throw new Error('A imagem não é um PNG.')
  return value
}

export function sanitizeFileName(name: string): string {
  return [...name]
    .map((ch) => (ch.charCodeAt(0) < 32 ? '-' : ch))
    .join('')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}
