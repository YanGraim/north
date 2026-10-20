import { IpcChannels } from '@shared/ipc'
import { CreateClientInputSchema, IdSchema, UpdateClientInputSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'
import type { InventoryStore } from '../workspaces/inventory-store'
import { deleteSecretsForScope } from './vault-cleanup'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerClientHandlers(
  repos: Repositories,
  vault: CredentialVault,
  inventory: () => InventoryStore
): void {
  ipcMain.handle(IpcChannels.CLIENTS_LIST, async () => await inventory().clients.list())

  ipcMain.handle(IpcChannels.CLIENTS_GET, async (_event, id: unknown) => {
    return await inventory().clients.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.CLIENTS_CREATE, async (_event, input: unknown) => {
    return await inventory().clients.create(CreateClientInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.CLIENTS_UPDATE, async (_event, id: unknown, input: unknown) => {
    const updated = await inventory().clients.update(
      IdSchema.parse(id),
      UpdateClientInputSchema.parse(input)
    )
    return requireEntity(updated, 'Client')
  })

  ipcMain.handle(IpcChannels.CLIENTS_DELETE, async (_event, id: unknown) => {
    const clientId = IdSchema.parse(id)
    if (!(await inventory().clients.get(clientId))) {
      throw new Error('Client not found')
    }
    deleteSecretsForScope(repos, vault, { clientId })
    await inventory().clients.delete(clientId)
  })
}
