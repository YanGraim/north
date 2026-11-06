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
import type { InventoryStore } from '../workspaces/inventory-store'
import type { SecretStore } from '../workspaces/secret-store'
import { deleteSecretsForAccess } from './vault-cleanup'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

/**
 * Accesses follow the active workspace (REC-023): SQLite for the personal one,
 * the North Server for an organization, which drops a deleted access's
 * password itself.
 */
export function registerAccessHandlers(
  repos: Repositories,
  vault: CredentialVault,
  inventory: () => InventoryStore,
  secrets: () => SecretStore
): void {
  ipcMain.handle(IpcChannels.ACCESSES_LIST, (_event, filter?: unknown) => {
    const parsed =
      filter === undefined || filter === null ? {} : ListAccessesFilterSchema.parse(filter)
    return inventory().accesses.list(parsed)
  })

  ipcMain.handle(IpcChannels.ACCESSES_GET, (_event, id: unknown) => {
    return inventory().accesses.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.ACCESSES_CREATE, (_event, input: unknown) => {
    return inventory().accesses.create(CreateAccessInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.ACCESSES_UPDATE, async (_event, id: unknown, input: unknown) => {
    const updated = await inventory().accesses.update(
      IdSchema.parse(id),
      UpdateAccessInputSchema.parse(input)
    )
    return requireEntity(updated, 'Access')
  })

  ipcMain.handle(IpcChannels.ACCESSES_DELETE, async (_event, id: unknown) => {
    const accessId = IdSchema.parse(id)
    const store = inventory()
    const existing = await store.accesses.get(accessId)
    if (!existing) {
      throw new Error('Access not found')
    }
    if (secrets().kind === 'local') deleteSecretsForAccess(repos, vault, existing)
    await store.accesses.delete(accessId)
  })

  ipcMain.handle(IpcChannels.ACCESSES_TOGGLE_FAVORITE, async (_event, id: unknown) => {
    return requireEntity(await inventory().accesses.toggleFavorite(IdSchema.parse(id)), 'Access')
  })
}
