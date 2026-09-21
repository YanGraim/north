import { IpcChannels } from '@shared/ipc'
import { IdSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'

export function registerEnvironmentUpdateHandlers(repos: Repositories): void {
  ipcMain.handle(
    IpcChannels.ENVIRONMENT_UPDATES_LIST,
    (_event, environmentId: unknown, limit?: unknown) => {
      const parsedLimit = limit === undefined ? undefined : Number(limit)
      return repos.environmentUpdates.listByEnvironment(IdSchema.parse(environmentId), parsedLimit)
    }
  )

  ipcMain.handle(IpcChannels.ENVIRONMENT_UPDATES_LIST_RECENT, (_event, limit?: unknown) => {
    const parsedLimit = limit === undefined ? undefined : Number(limit)
    return repos.environmentUpdates.listRecent(parsedLimit)
  })
}
