import { IpcChannels } from '@shared/ipc'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import { buildSearchIndex } from '../services/search-index'

export function registerSearchHandlers(repos: Repositories): void {
  ipcMain.handle(IpcChannels.SEARCH_INDEX, () => buildSearchIndex(repos))
}
