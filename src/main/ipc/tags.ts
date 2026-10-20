import { IpcChannels } from '@shared/ipc'
import {
  CreateTagInputSchema,
  IdSchema,
  SetAccessTagsInputSchema,
  SetConnectionTagsInputSchema,
  UpdateTagInputSchema
} from '@shared/types'
import { ipcMain } from 'electron'
import type { InventoryStore } from '../workspaces/inventory-store'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerTagHandlers(inventory: () => InventoryStore): void {
  ipcMain.handle(IpcChannels.TAGS_LIST, async () => await inventory().tags.list())

  ipcMain.handle(IpcChannels.TAGS_CREATE, async (_event, input: unknown) => {
    return await inventory().tags.create(CreateTagInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.TAGS_UPDATE, async (_event, id: unknown, input: unknown) => {
    return requireEntity(
      await inventory().tags.update(IdSchema.parse(id), UpdateTagInputSchema.parse(input)),
      'Tag'
    )
  })

  ipcMain.handle(IpcChannels.TAGS_DELETE, async (_event, id: unknown) => {
    const ok = await inventory().tags.delete(IdSchema.parse(id))
    if (!ok) {
      throw new Error('Tag not found')
    }
  })

  ipcMain.handle(IpcChannels.TAGS_SET_FOR_CONNECTION, async (_event, input: unknown) => {
    return await inventory().tags.setForConnection(SetConnectionTagsInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.TAGS_LIST_FOR_CONNECTION, async (_event, connectionId: unknown) => {
    return await inventory().tags.listForConnection(IdSchema.parse(connectionId))
  })

  ipcMain.handle(IpcChannels.TAGS_SET_FOR_ACCESS, async (_event, input: unknown) => {
    return await inventory().tags.setForAccess(SetAccessTagsInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.TAGS_LIST_FOR_ACCESS, async (_event, accessId: unknown) => {
    return await inventory().tags.listForAccess(IdSchema.parse(accessId))
  })
}
