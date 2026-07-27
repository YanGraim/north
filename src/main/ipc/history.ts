import { IpcChannels } from '@shared/ipc'
import { ListHistoryFilterSchema, RecordConnectionInputSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'

export function registerHistoryHandlers(repos: Repositories): void {
  ipcMain.handle(IpcChannels.HISTORY_LIST, (_event, filter?: unknown) => {
    const parsed =
      filter === undefined || filter === null ? {} : ListHistoryFilterSchema.parse(filter)
    return repos.history.list(parsed)
  })

  ipcMain.handle(IpcChannels.HISTORY_RECORD, (_event, input: unknown) => {
    return repos.history.record(RecordConnectionInputSchema.parse(input))
  })
}
