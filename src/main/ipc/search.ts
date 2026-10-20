import { IpcChannels } from '@shared/ipc'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import { buildSearchIndex } from '../services/search-index'
import type { InventoryStore } from '../workspaces/inventory-store'

export function registerSearchHandlers(repos: Repositories, inventory: () => InventoryStore): void {
  ipcMain.handle(IpcChannels.SEARCH_INDEX, () => buildSearchIndex(repos, inventory()))
}
