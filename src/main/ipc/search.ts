import { IpcChannels } from '@shared/ipc'
import { ipcMain } from 'electron'
import { buildSearchIndex } from '../services/search-index'
import type { InventoryStore } from '../workspaces/inventory-store'

export function registerSearchHandlers(inventory: () => InventoryStore): void {
  ipcMain.handle(IpcChannels.SEARCH_INDEX, () => buildSearchIndex(inventory()))
}
