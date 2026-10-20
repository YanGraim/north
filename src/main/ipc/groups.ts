import { IpcChannels } from '@shared/ipc'
import { CreateGroupInputSchema, IdSchema, UpdateGroupInputSchema } from '@shared/types'
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

export function registerGroupHandlers(
  repos: Repositories,
  vault: CredentialVault,
  inventory: () => InventoryStore
): void {
  ipcMain.handle(IpcChannels.GROUPS_LIST, async (_event, environmentId?: unknown) => {
    const parsed =
      environmentId === undefined || environmentId === null
        ? undefined
        : IdSchema.parse(environmentId)
    return await inventory().groups.list(parsed)
  })

  ipcMain.handle(IpcChannels.GROUPS_GET, async (_event, id: unknown) => {
    return await inventory().groups.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.GROUPS_CREATE, async (_event, input: unknown) => {
    return await inventory().groups.create(CreateGroupInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.GROUPS_UPDATE, async (_event, id: unknown, input: unknown) => {
    const updated = await inventory().groups.update(
      IdSchema.parse(id),
      UpdateGroupInputSchema.parse(input)
    )
    return requireEntity(updated, 'Group')
  })

  ipcMain.handle(IpcChannels.GROUPS_DELETE, async (_event, id: unknown) => {
    const groupId = IdSchema.parse(id)
    if (!(await inventory().groups.get(groupId))) {
      throw new Error('Group not found')
    }
    deleteSecretsForScope(repos, vault, { groupId })
    await inventory().groups.delete(groupId)
  })
}
