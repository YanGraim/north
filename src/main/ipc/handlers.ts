import os from 'node:os'
import { IpcChannels } from '@shared/ipc'
import { app, ipcMain } from 'electron'
import { initDatabase } from '../database'
import { maybeSeedDevData } from '../database/seed'
import { createRepositories, type Repositories } from '../repositories'
import { CredentialVault, SafeStorageEncryptor } from '../vault'
import { registerAccessHandlers } from './accesses'
import { registerClientHandlers } from './clients'
import { registerConnectionHandlers } from './connections'
import { registerDatabaseHandlers } from './db'
import { registerEnvironmentHandlers } from './environments'
import { registerFsHandlers } from './fs'
import { registerGroupHandlers } from './groups'
import { registerHistoryHandlers } from './history'
import { registerInventoryHandlers } from './inventory'
import { registerSearchHandlers } from './search'
import { registerSerialHandlers } from './serial'
import { registerSessionHandlers } from './sessions'
import { registerStatsHandlers } from './stats'
import { registerTagHandlers } from './tags'
import { registerThemeHandlers } from './theme'
import { registerUpdateHandlers } from './updates'
import { registerVaultHandlers } from './vault'
import { registerWorkflowHandlers } from './workflows'

let repositories: Repositories | null = null
let vault: CredentialVault | null = null

export function getRepositories(): Repositories {
  if (!repositories) {
    throw new Error('Repositories not initialized')
  }
  return repositories
}

export function getVault(): CredentialVault {
  if (!vault) {
    throw new Error('Vault not initialized')
  }
  return vault
}

export function registerIpcHandlers(): void {
  const db = initDatabase()
  repositories = createRepositories(db)
  vault = new CredentialVault(repositories.credentials, new SafeStorageEncryptor())

  maybeSeedDevData(repositories)

  ipcMain.handle(IpcChannels.APP_GET_VERSION, (): string => {
    return app.getVersion()
  })
  ipcMain.handle(IpcChannels.APP_GET_IDENTITY, () => ({
    osUsername: os.userInfo().username
  }))
  registerThemeHandlers()

  registerVaultHandlers(vault, repositories)
  registerClientHandlers(repositories, vault)
  registerEnvironmentHandlers(repositories, vault)
  registerGroupHandlers(repositories, vault)
  registerConnectionHandlers(repositories, vault)
  registerAccessHandlers(repositories, vault)
  registerTagHandlers(repositories)
  registerHistoryHandlers(repositories)
  registerSearchHandlers(repositories)
  registerSessionHandlers(repositories, vault)
  registerDatabaseHandlers(repositories, vault)
  registerFsHandlers()
  registerSerialHandlers()
  registerStatsHandlers(repositories)
  registerInventoryHandlers(repositories, vault)
  registerUpdateHandlers()
  registerWorkflowHandlers(repositories, vault)
}
