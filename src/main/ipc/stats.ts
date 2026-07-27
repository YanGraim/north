import { IpcChannels } from '@shared/ipc'
import type { StatsOverview } from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'

export function registerStatsHandlers(repositories: Repositories): void {
  ipcMain.handle(IpcChannels.STATS_OVERVIEW, (): StatsOverview => {
    const clients = repositories.clients.list()
    const connections = repositories.connections.list()
    const favorites = connections.filter((c) => c.isFavorite)
    const recent = [...connections]
      .filter((c) => c.lastConnectedAt)
      .sort((a, b) => (b.lastConnectedAt ?? '').localeCompare(a.lastConnectedAt ?? ''))
      .slice(0, 8)
    const mostUsed = [...connections]
      .sort((a, b) => b.accessCount - a.accessCount || b.totalConnectedMs - a.totalConnectedMs)
      .filter((c) => c.accessCount > 0)
      .slice(0, 8)
    const activity = repositories.history.list({ limit: 12 })

    return {
      totals: {
        clients: clients.length,
        connections: connections.length,
        favorites: favorites.length
      },
      favorites: favorites.slice(0, 8),
      recent,
      mostUsed,
      activity
    }
  })
}
