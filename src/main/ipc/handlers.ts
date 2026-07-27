import { IpcChannels } from '@shared/ipc'
import { app, ipcMain } from 'electron'
import { initDatabase } from '../database'
import { maybeSeedDevData } from '../database/seed'
import { createRepositories, type Repositories } from '../repositories'
import { registerClientHandlers } from './clients'
import { registerConnectionHandlers } from './connections'
import { registerEnvironmentHandlers } from './environments'
import { registerGroupHandlers } from './groups'
import { registerHistoryHandlers } from './history'
import { registerTagHandlers } from './tags'

let repositories: Repositories | null = null

export function getRepositories(): Repositories {
  if (!repositories) {
    throw new Error('Repositories not initialized')
  }
  return repositories
}

export function registerIpcHandlers(): void {
  const db = initDatabase()
  repositories = createRepositories(db)

  maybeSeedDevData(repositories)

  ipcMain.handle(IpcChannels.APP_GET_VERSION, (): string => {
    return app.getVersion()
  })

  registerClientHandlers(repositories)
  registerEnvironmentHandlers(repositories)
  registerGroupHandlers(repositories)
  registerConnectionHandlers(repositories)
  registerTagHandlers(repositories)
  registerHistoryHandlers(repositories)
}
