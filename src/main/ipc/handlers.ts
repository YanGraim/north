import os from 'node:os'
import { IpcChannels } from '@shared/ipc'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
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
import { registerFsHandlers, registerLocalFsHandlers } from './fs'
import { registerGroupHandlers } from './groups'
import { registerHistoryHandlers } from './history'
import { registerInventoryHandlers } from './inventory'
import { reconcileLogFollows, registerLogFollowHandlers } from './log-follows'
import { registerRemoteEditHandlers } from './remote-edit'
import { registerSearchHandlers } from './search'
import { registerSerialHandlers } from './serial'
import { getProtocolManager, registerSessionHandlers } from './sessions'
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
    vault,
    // Only the Microsoft sign-in page; the URL comes from the server's discovery document.
    openBrowser: (url) => {
      if (!/^https:\/\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
        throw new Error('Endereço de login inválido')
      }
      return shell.openExternal(url)
    }
  })
  // Handlers read through the active workspace: the tree via the async inventory, the rest via repos.
  repositories = createScopedRepositories(registry)
  const inventory = () => registry.inventory()
  const secrets = () => registry.secrets()

  maybeSeedDevData(localRepositories)
  registerWorkspaceHandlers(registry)

  ipcMain.handle(IpcChannels.APP_GET_VERSION, (): string => {
    return app.getVersion()
  })
  ipcMain.handle(IpcChannels.APP_GET_IDENTITY, () => ({
    osUsername: os.userInfo().username
  }))
  registerThemeHandlers()

  registerVaultHandlers(vault, repositories, secrets, inventory)
  registerClientHandlers(repositories, vault, inventory)
  registerEnvironmentHandlers(repositories, vault, inventory)
  registerGroupHandlers(repositories, vault, inventory)
  registerConnectionHandlers(vault, inventory, secrets, localRepositories.directoryFavorites)
  registerAccessHandlers(repositories, vault, inventory, secrets)
  registerTagHandlers(inventory)
  registerHistoryHandlers(repositories)
  registerSearchHandlers(inventory)
  registerSessionHandlers(repositories, vault)
  registerLogFollowHandlers()
  // Organizations open sessions from the server's inventory, fetching each password just in time.
  getProtocolManager().setConnectionSource(() => {
    if (registry.activeSource().kind === 'local') return null
    const store = registry.inventory()
    const passwords = registry.secrets()
    return {
      connection: (id) => store.connections.get(id),
      resolveSecret: (ref) => passwords.resolve(ref, 'session'),
      vpnProfile: async (id) => {
        const connection = await store.connections.get(id)
        return connection ? registry.organizationVpnFor(connection) : null
      },
      access: (id) => store.accesses.get(id),
      accessVpnProfile: async (id) => {
        const access = await store.accesses.get(id)
        return access ? registry.organizationVpnFor(access) : null
      },
      scope: registry.activeId()
    }
  })
  // Organization pushes (ADR 0018 fase 5): refresh the renderer, end sessions that lost access.
  registry.onEvent((event) => {
    const manager = getProtocolManager()
    // A deleted connection or a lost grant both end the sessions that depended on it.
    if (event.kind !== 'signed-out') void manager.revalidate(event.workspaceId)
    if (event.kind === 'signed-out') {
      void manager.closeScope(
        event.workspaceId,
        event.reason === 'revoked'
          ? 'Seu acesso a esta organização foi removido.'
          : 'Sua sessão nesta organização terminou. Entre de novo.'
      )
    }
    void reconcileLogFollows()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IpcChannels.WORKSPACES_EVENT, event)
    }
  })
  app.on('will-quit', () => registry.dispose())
  registerDatabaseHandlers(inventory, secrets)
  registerApiHandlers(repositories, vault)
  registerFsHandlers()
  registerRemoteEditHandlers()
  registerLocalFsHandlers()
  registerSerialHandlers()
  registerStatsHandlers(repositories, inventory)
  registerInventoryHandlers(repositories, () => registry.activeSource())
  registerUpdateHandlers()
  registerWorkflowHandlers(() => {
    const store = registry.inventory()
    const local = registry.activeSource().kind === 'local'
    const passwords = registry.secrets()
    return {
      store: registry.workflows(),
      connection: (id) => store.connections.get(id),
      group: (id) => store.groups.get(id),
      resolveSecret: (ref) => passwords.resolve(ref, 'session'),
      updateConnectionCredential: local
        ? async (id, credentialRef) => {
            await store.connections.update(id, { credentialRef })
          }
        : undefined
    }
  }, vault)
  registerAgentWorkspaceHandlers(repositories)
  registerEnvironmentUpdateHandlers(() => registry.workflows())
  registerTerminalHandlers()
  const monitor = registerConnectionHealthHandlers(repositories)
  // VPN profiles live on this computer; an organization only says which one (REC-023).
  registerVpnHandlers(repositories, vault, monitor, {
    link: (target, id) => registry.organizationVpnLink(target, id),
    setLink: (target, id, profileId) => registry.setOrganizationVpnLink(target, id, profileId),
    workspace: () => registry.vpnWorkspaceId(),
    clientOf: (profileId) => registry.organizationVpnClient(profileId),
    access: async (id) => {
      if (registry.activeSource().kind === 'local') return undefined
      const access = await registry.inventory().accesses.get(id)
      return access ? registry.organizationVpnFor(access) : null
    }
  })
}
