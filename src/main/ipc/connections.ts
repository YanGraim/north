import { IpcChannels } from '@shared/ipc'
import {
  CreateConnectionInputSchema,
  IdSchema,
  ListConnectionsFilterSchema,
  UpdateConnectionInputSchema
} from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'
import { deleteSecretsForConnections } from './vault-cleanup'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerConnectionHandlers(repos: Repositories, vault: CredentialVault): void {
  ipcMain.handle(IpcChannels.CONNECTIONS_LIST, (_event, filter?: unknown) => {
    const parsed =
      filter === undefined || filter === null ? {} : ListConnectionsFilterSchema.parse(filter)
    return repos.connections.list(parsed)
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_GET, (_event, id: unknown) => {
    return repos.connections.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_CREATE, (_event, input: unknown) => {
    return repos.connections.create(CreateConnectionInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_UPDATE, (_event, id: unknown, input: unknown) => {
    const updated = repos.connections.update(
      IdSchema.parse(id),
      UpdateConnectionInputSchema.parse(input)
    )
    return requireEntity(updated, 'Connection')
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_DELETE, (_event, id: unknown) => {
    const connectionId = IdSchema.parse(id)
    const existing = repos.connections.get(connectionId)
    if (!existing) {
      throw new Error('Connection not found')
    }
    if (existing.credentialRef) {
      vault.deleteSecret(existing.credentialRef)
    }
    repos.connections.delete(connectionId)
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_TOGGLE_FAVORITE, (_event, id: unknown) => {
    return requireEntity(repos.connections.toggleFavorite(IdSchema.parse(id)), 'Connection')
  })

  ipcMain.handle(IpcChannels.CONNECTIONS_DUPLICATE, (_event, id: unknown) => {
    const connectionId = IdSchema.parse(id)
    const existing = repos.connections.get(connectionId)
    if (!existing) {
      throw new Error('Connection not found')
    }

    const copy = requireEntity(repos.connections.duplicate(connectionId), 'Connection')

    if (
      existing.credentialRef &&
      vault.hasSecret(existing.credentialRef) &&
      vault.isEncryptionAvailable()
    ) {
      const secret = vault.resolveSecret(existing.credentialRef)
      const newRef = vault.setSecret(secret)
      return requireEntity(
        repos.connections.update(copy.id, { credentialRef: newRef }),
        'Connection'
      )
    }

    return copy
  })
}

export { deleteSecretsForConnections }
