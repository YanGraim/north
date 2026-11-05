import { IpcChannels } from '@shared/ipc'
import {
  CreateConnectionInputSchema,
  IdSchema,
  ListConnectionsFilterSchema,
  UpdateConnectionInputSchema
} from '@shared/types'
import { ipcMain } from 'electron'
import type { ConnectionDirectoryFavoritesRepository } from '../repositories/connection-directory-favorites-repository'
import type { CredentialVault } from '../vault'
import type { InventoryStore } from '../workspaces/inventory-store'
import type { SecretStore } from '../workspaces/secret-store'
import { stopLogFollowsForConnection } from './log-follows'
import { deleteSecretsForConnections } from './vault-cleanup'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerConnectionHandlers(
  vault: CredentialVault,
  inventory: () => InventoryStore,
  secrets: () => SecretStore,
  directoryFavorites: ConnectionDirectoryFavoritesRepository
): void {
  ipcMain.handle(IpcChannels.CONNECTIONS_LIST, async (_event, filter?: unknown) => {
    const parsed =
      filter === undefined || filter === null ? {} : ListConnectionsFilterSchema.parse(filter)
    return await inventory().connections.list(parsed)
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_GET, async (_event, id: unknown) => {
    return await inventory().connections.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_CREATE, async (_event, input: unknown) => {
    return await inventory().connections.create(CreateConnectionInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_UPDATE, async (_event, id: unknown, input: unknown) => {
    const updated = await inventory().connections.update(
      IdSchema.parse(id),
      UpdateConnectionInputSchema.parse(input)
    )
    return requireEntity(updated, 'Connection')
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_DELETE, async (_event, id: unknown) => {
    const connectionId = IdSchema.parse(id)
    const existing = await inventory().connections.get(connectionId)
    if (!existing) {
      throw new Error('Connection not found')
    }
    // An organization drops the secret along with the connection, on the server.
    if (existing.credentialRef && secrets().kind === 'local') {
      vault.deleteSecret(existing.credentialRef)
    }
    directoryFavorites.removeAll(connectionId)
    await inventory().connections.delete(connectionId)
    await stopLogFollowsForConnection(connectionId)
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_TOGGLE_FAVORITE, async (_event, id: unknown) => {
    return requireEntity(
      await inventory().connections.toggleFavorite(IdSchema.parse(id)),
      'Connection'
    )
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_DUPLICATE, async (_event, id: unknown) => {
    const connectionId = IdSchema.parse(id)
    const existing = await inventory().connections.get(connectionId)
    if (!existing) {
      throw new Error('Connection not found')
    }

    const copy = requireEntity(await inventory().connections.duplicate(connectionId), 'Connection')
    // The North Server re-seals the secret for the copy by itself.
    if (secrets().kind === 'remote') return copy

    if (
      existing.credentialRef &&
      vault.hasSecret(existing.credentialRef) &&
      vault.isEncryptionAvailable()
    ) {
      const secret = vault.resolveSecret(existing.credentialRef)
      const newRef = vault.setSecret(secret)
      return requireEntity(
        await inventory().connections.update(copy.id, { credentialRef: newRef }),
        'Connection'
      )
    }

    return copy
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_LIST_DIRECTORY_FAVORITES, async (_event, id: unknown) => {
    return directoryFavorites.list(IdSchema.parse(id))
  })

  ipcMain.handle(
    IpcChannels.CONNECTIONS_ADD_DIRECTORY_FAVORITE,
    async (_event, id: unknown, path: unknown) => {
      const connectionId = IdSchema.parse(id)
      if (typeof path !== 'string') return { status: 'invalid' as const }
      const existing = await inventory().connections.get(connectionId)
      if (!existing) return { status: 'invalid' as const }
      return directoryFavorites.add(connectionId, path)
    }
  )

  ipcMain.handle(
    IpcChannels.CONNECTIONS_REMOVE_DIRECTORY_FAVORITE,
    async (_event, id: unknown, path: unknown) => {
      if (typeof path !== 'string') return
      directoryFavorites.remove(IdSchema.parse(id), path)
    }
  )
}

export { deleteSecretsForConnections }
