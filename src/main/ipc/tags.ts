import { IpcChannels } from '@shared/ipc'
import {
  CreateTagInputSchema,
  IdSchema,
  SetAccessTagsInputSchema,
  SetConnectionTagsInputSchema,
  UpdateTagInputSchema
} from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerTagHandlers(repos: Repositories): void {
  ipcMain.handle(IpcChannels.TAGS_LIST, () => repos.tags.list())

  ipcMain.handle(IpcChannels.TAGS_CREATE, (_event, input: unknown) => {
    return repos.tags.create(CreateTagInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.TAGS_UPDATE, (_event, id: unknown, input: unknown) => {
    return requireEntity(
      repos.tags.update(IdSchema.parse(id), UpdateTagInputSchema.parse(input)),
      'Tag'
    )
  })

  ipcMain.handle(IpcChannels.TAGS_DELETE, (_event, id: unknown) => {
    const ok = repos.tags.delete(IdSchema.parse(id))
    if (!ok) {
      throw new Error('Tag not found')
    }
  })

  ipcMain.handle(IpcChannels.TAGS_SET_FOR_CONNECTION, (_event, input: unknown) => {
    return repos.tags.setForConnection(SetConnectionTagsInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.TAGS_LIST_FOR_CONNECTION, (_event, connectionId: unknown) => {
    return repos.tags.listForConnection(IdSchema.parse(connectionId))
  })

  ipcMain.handle(IpcChannels.TAGS_SET_FOR_ACCESS, (_event, input: unknown) => {
    return repos.tags.setForAccess(SetAccessTagsInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.TAGS_LIST_FOR_ACCESS, (_event, accessId: unknown) => {
    return repos.tags.listForAccess(IdSchema.parse(accessId))
  })
}
