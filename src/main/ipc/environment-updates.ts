import { IpcChannels } from '@shared/ipc'
import { IdSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { WorkflowStore } from '../workspaces/workflow-store'

/** History of git-tracked runs; in an organization it is the team's, with who ran each (REC-024). */
export function registerEnvironmentUpdateHandlers(store: () => WorkflowStore): void {
  ipcMain.handle(
    IpcChannels.ENVIRONMENT_UPDATES_LIST,
    (_event, environmentId: unknown, limit?: unknown) => {
      const parsedLimit = limit === undefined ? undefined : Number(limit)
      return store().updates.listByEnvironment(IdSchema.parse(environmentId), parsedLimit)
    }
  )

  ipcMain.handle(IpcChannels.ENVIRONMENT_UPDATES_LIST_RECENT, (_event, limit?: unknown) => {
    const parsedLimit = limit === undefined ? undefined : Number(limit)
    return store().updates.listRecent(parsedLimit)
  })
}
