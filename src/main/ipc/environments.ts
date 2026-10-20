import { IpcChannels } from '@shared/ipc'
import { CreateEnvironmentInputSchema, IdSchema, UpdateEnvironmentInputSchema } from '@shared/types'
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

export function registerEnvironmentHandlers(
  repos: Repositories,
  vault: CredentialVault,
  inventory: () => InventoryStore
): void {
  ipcMain.handle(IpcChannels.ENVIRONMENTS_LIST, async (_event, clientId?: unknown) => {
    const parsed =
      clientId === undefined || clientId === null ? undefined : IdSchema.parse(clientId)
    return await inventory().environments.list(parsed)
  })

  ipcMain.handle(IpcChannels.ENVIRONMENTS_GET, async (_event, id: unknown) => {
    return await inventory().environments.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.ENVIRONMENTS_CREATE, async (_event, input: unknown) => {
    return await inventory().environments.create(CreateEnvironmentInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.ENVIRONMENTS_UPDATE, async (_event, id: unknown, input: unknown) => {
    const updated = await inventory().environments.update(
      IdSchema.parse(id),
      UpdateEnvironmentInputSchema.parse(input)
    )
    return requireEntity(updated, 'Environment')
  })

  ipcMain.handle(IpcChannels.ENVIRONMENTS_DELETE, async (_event, id: unknown) => {
    const environmentId = IdSchema.parse(id)
    if (!(await inventory().environments.get(environmentId))) {
      throw new Error('Environment not found')
    }
    deleteSecretsForScope(repos, vault, { environmentId })
    await inventory().environments.delete(environmentId)
  })
}
