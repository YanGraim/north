import { IpcChannels } from '@shared/ipc'
import {
  AddOrganizationInputSchema,
  CopyToWorkspaceInputSchema,
  WorkspaceIdSchema
} from '@shared/types'
import { ipcMain } from 'electron'
import { z } from 'zod'
import type { WorkspaceRegistry } from '../workspaces/workspace-registry'

export function registerWorkspaceHandlers(registry: WorkspaceRegistry): void {
  ipcMain.handle(IpcChannels.WORKSPACES_LIST, () => registry.list())

  ipcMain.handle(IpcChannels.WORKSPACES_ACTIVATE, (_event, id: unknown) =>
    registry.activate(WorkspaceIdSchema.parse(id))
  )

  ipcMain.handle(IpcChannels.WORKSPACES_PROBE, (_event, serverUrl: unknown) =>
    registry.probe(z.string().min(1).max(500).parse(serverUrl))
  )

  ipcMain.handle(IpcChannels.WORKSPACES_ADD_ORGANIZATION, (_event, input: unknown) =>
    registry.addOrganization(AddOrganizationInputSchema.parse(input))
  )

  ipcMain.handle(IpcChannels.WORKSPACES_CANCEL_SIGN_IN, () => registry.cancelSignIn())

  ipcMain.handle(IpcChannels.WORKSPACES_COPY_TARGETS, (_event, workspaceId: unknown) =>
    registry.copyTargets(z.string().min(1).max(100).parse(workspaceId))
  )

  ipcMain.handle(IpcChannels.WORKSPACES_COPY, (_event, input: unknown) =>
    registry.copyToWorkspace(CopyToWorkspaceInputSchema.parse(input))
  )

  ipcMain.handle(IpcChannels.WORKSPACES_ACCESS, () => registry.access())

  ipcMain.handle(IpcChannels.WORKSPACES_REMOVE, async (_event, id: unknown) => {
    await registry.removeOrganization(WorkspaceIdSchema.parse(id))
  })
}
