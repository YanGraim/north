import os from 'node:os'
import { IpcChannels } from '@shared/ipc'
import { app, ipcMain } from 'electron'
import { initDatabase } from '../database'
import { maybeSeedDevData } from '../database/seed'
import { createRepositories, type Repositories } from '../repositories'
import { WorkspacesRepository } from '../repositories/workspaces-repository'
import { CredentialVault, SafeStorageEncryptor } from '../vault'
import { createScopedRepositories, WorkspaceRegistry } from '../workspaces/workspace-registry'
import { registerAccessHandlers } from './accesses'
import { registerAgentWorkspaceHandlers } from './agent-workspaces'
import { registerApiHandlers } from './api'
import { registerClientHandlers } from './clients'
import { registerConnectionHealthHandlers } from './connection-health'
import { registerConnectionHandlers } from './connections'
import { registerDatabaseHandlers } from './db'
import { registerEnvironmentUpdateHandlers } from './environment-updates'
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
import { registerTerminalHandlers } from './terminal'
import { registerThemeHandlers } from './theme'
import { registerUpdateHandlers } from './updates'
import { registerVaultHandlers } from './vault'
import { registerVpnHandlers } from './vpn'
import { registerWorkflowHandlers } from './workflows'
import { registerWorkspaceHandlers } from './workspaces'

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
  const localRepositories = createRepositories(db)
  // The vault stays on the local DB for every workspace (ADR 0018 §8).
  vault = new CredentialVault(localRepositories.credentials, new SafeStorageEncryptor())
  const registry = new WorkspaceRegistry({
    workspaces: new WorkspacesRepository(db),
    local: localRepositories,
    vault
  })
  // Handlers read through the active workspace: the tree via the async inventory, the rest via repos.
  repositories = createScopedRepositories(registry)
  const inventory = () => registry.inventory()

  maybeSeedDevData(localRepositories)
  registerWorkspaceHandlers(registry)

  ipcMain.handle(IpcChannels.APP_GET_VERSION, (): string => {
    return app.getVersion()
  })
  ipcMain.handle(IpcChannels.APP_GET_IDENTITY, () => ({
    osUsername: os.userInfo().username
  }))
  registerThemeHandlers()

  registerVaultHandlers(vault, repositories)
  registerClientHandlers(repositories, vault, inventory)
  registerEnvironmentHandlers(repositories, vault, inventory)
  registerGroupHandlers(repositories, vault, inventory)
  registerConnectionHandlers(vault, inventory)
  registerAccessHandlers(repositories, vault)
  registerTagHandlers(inventory)
  registerHistoryHandlers(repositories)
  registerSearchHandlers(repositories, inventory)
  registerSessionHandlers(repositories, vault)
  registerDatabaseHandlers(repositories, vault)
  registerApiHandlers(repositories, vault)
  registerFsHandlers()
  registerSerialHandlers()
  registerStatsHandlers(repositories, inventory)
  registerInventoryHandlers(repositories, vault)
  registerUpdateHandlers()
  registerWorkflowHandlers(repositories, vault)
  registerAgentWorkspaceHandlers(repositories)
  registerEnvironmentUpdateHandlers(repositories)
  registerTerminalHandlers()
  const monitor = registerConnectionHealthHandlers(repositories)
  registerVpnHandlers(repositories, vault, monitor)
}
