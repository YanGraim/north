import { IpcChannels } from '@shared/ipc'
import { WorkspaceIdSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { WorkspaceRegistry } from '../workspaces/workspace-registry'

export function registerWorkspaceHandlers(registry: WorkspaceRegistry): void {
  ipcMain.handle(IpcChannels.WORKSPACES_LIST, () => registry.list())

  ipcMain.handle(IpcChannels.WORKSPACES_ACTIVATE, (_event, id: unknown) =>
    registry.activate(WorkspaceIdSchema.parse(id))
  )
}
