import { IpcChannels } from '@shared/ipc'
import { IdSchema } from '@shared/types'
import { BrowserWindow, ipcMain, Notification } from 'electron'
import type { Repositories } from '../repositories'
import { ConnectionMonitorService } from '../services/connection-monitor-service'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

function notifyStatusChange(connectionName: string, status: 'up' | 'down'): void {
  if (!Notification.isSupported()) return
  new Notification({
    title: status === 'down' ? 'Conexão indisponível' : 'Conexão voltou ao ar',
    body:
      status === 'down'
        ? `${connectionName} parou de responder.`
        : `${connectionName} está respondendo de novo.`
  }).show()
}

export function registerConnectionHealthHandlers(repos: Repositories): ConnectionMonitorService {
  const service = new ConnectionMonitorService(repos, {
    onChange: ({ connectionId, status }) => {
      broadcast(IpcChannels.CONNECTION_HEALTH_CHANGED, { connectionId, status })
      const connection = repos.connections.get(connectionId)
      if (connection) notifyStatusChange(connection.name, status)
    }
  })
  service.start()

  ipcMain.handle(IpcChannels.CONNECTION_MONITORS_LIST, () => {
    return repos.connectionMonitors.listAll()
  })

  ipcMain.handle(
    IpcChannels.CONNECTION_MONITORS_SET_ENABLED,
    (_event, connectionId: unknown, enabled: unknown) => {
      const monitor = repos.connectionMonitors.setEnabled(
        IdSchema.parse(connectionId),
        Boolean(enabled)
      )
      if (monitor.enabled) void service.checkAllOnce()
      return monitor
    }
  )

  ipcMain.handle(
    IpcChannels.CONNECTION_HEALTH_EVENTS_LIST,
    (_event, connectionId: unknown, limit?: unknown) => {
      const parsedLimit = limit === undefined ? undefined : Number(limit)
      return repos.connectionHealthEvents.listByConnection(
        IdSchema.parse(connectionId),
        parsedLimit
      )
    }
  )

  ipcMain.handle(IpcChannels.CONNECTION_HEALTH_EVENTS_LIST_RECENT, (_event, limit?: unknown) => {
    const parsedLimit = limit === undefined ? undefined : Number(limit)
    return repos.connectionHealthEvents.listRecent(parsedLimit)
  })

  return service
}
