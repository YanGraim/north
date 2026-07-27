import { IpcChannels } from '@shared/ipc'
import { CreateClientInputSchema, IdSchema, UpdateClientInputSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'
import { deleteSecretsForScope } from './vault-cleanup'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerClientHandlers(repos: Repositories, vault: CredentialVault): void {
  ipcMain.handle(IpcChannels.CLIENTS_LIST, () => repos.clients.list())

  ipcMain.handle(IpcChannels.CLIENTS_GET, (_event, id: unknown) => {
    return repos.clients.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.CLIENTS_CREATE, (_event, input: unknown) => {
    return repos.clients.create(CreateClientInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.CLIENTS_UPDATE, (_event, id: unknown, input: unknown) => {
    const updated = repos.clients.update(IdSchema.parse(id), UpdateClientInputSchema.parse(input))
    return requireEntity(updated, 'Client')
  })

  ipcMain.handle(IpcChannels.CLIENTS_DELETE, (_event, id: unknown) => {
    const clientId = IdSchema.parse(id)
    if (!repos.clients.get(clientId)) {
      throw new Error('Client not found')
    }
    deleteSecretsForScope(repos, vault, { clientId })
    repos.clients.delete(clientId)
  })
}
