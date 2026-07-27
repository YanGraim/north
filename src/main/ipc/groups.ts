import { IpcChannels } from '@shared/ipc'
import { CreateGroupInputSchema, IdSchema, UpdateGroupInputSchema } from '@shared/types'
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

export function registerGroupHandlers(repos: Repositories, vault: CredentialVault): void {
  ipcMain.handle(IpcChannels.GROUPS_LIST, (_event, environmentId?: unknown) => {
    const parsed =
      environmentId === undefined || environmentId === null
        ? undefined
        : IdSchema.parse(environmentId)
    return repos.groups.list(parsed)
  })

  ipcMain.handle(IpcChannels.GROUPS_GET, (_event, id: unknown) => {
    return repos.groups.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.GROUPS_CREATE, (_event, input: unknown) => {
    return repos.groups.create(CreateGroupInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.GROUPS_UPDATE, (_event, id: unknown, input: unknown) => {
    const updated = repos.groups.update(IdSchema.parse(id), UpdateGroupInputSchema.parse(input))
    return requireEntity(updated, 'Group')
  })

  ipcMain.handle(IpcChannels.GROUPS_DELETE, (_event, id: unknown) => {
    const groupId = IdSchema.parse(id)
    if (!repos.groups.get(groupId)) {
      throw new Error('Group not found')
    }
    deleteSecretsForScope(repos, vault, { groupId })
    repos.groups.delete(groupId)
  })
}
