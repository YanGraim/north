import { IpcChannels } from '@shared/ipc'
import {
  CreateAccessInputSchema,
  IdSchema,
  ListAccessesFilterSchema,
  UpdateAccessInputSchema
} from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerAccessHandlers(repos: Repositories, vault: CredentialVault): void {
  ipcMain.handle(IpcChannels.ACCESSES_LIST, (_event, filter?: unknown) => {
    const parsed =
      filter === undefined || filter === null ? {} : ListAccessesFilterSchema.parse(filter)
    return repos.accesses.list(parsed)
  })

  ipcMain.handle(IpcChannels.ACCESSES_GET, (_event, id: unknown) => {
    return repos.accesses.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.ACCESSES_CREATE, (_event, input: unknown) => {
    return repos.accesses.create(CreateAccessInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.ACCESSES_UPDATE, (_event, id: unknown, input: unknown) => {
    const updated = repos.accesses.update(IdSchema.parse(id), UpdateAccessInputSchema.parse(input))
    return requireEntity(updated, 'Access')
  })

  ipcMain.handle(IpcChannels.ACCESSES_DELETE, (_event, id: unknown) => {
    const accessId = IdSchema.parse(id)
    const existing = repos.accesses.get(accessId)
    if (!existing) {
      throw new Error('Access not found')
    }
    if (existing.credentialRef) {
      vault.deleteSecret(existing.credentialRef)
    }
    repos.accesses.delete(accessId)
  })

  ipcMain.handle(IpcChannels.ACCESSES_TOGGLE_FAVORITE, (_event, id: unknown) => {
    return requireEntity(repos.accesses.toggleFavorite(IdSchema.parse(id)), 'Access')
  })
}
