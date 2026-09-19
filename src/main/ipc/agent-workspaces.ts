import { IpcChannels } from '@shared/ipc'
import {
  CreateAgentBoardColumnInputSchema,
  CreateAgentWorkspaceInputSchema,
  IdSchema,
  UpdateAgentBoardColumnInputSchema,
  UpdateAgentWorkspaceInputSchema
} from '@shared/types'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  addWorktree,
  branchExists,
  removeWorktree,
  repoNameFromPath,
  worktreePathFor
} from '../lib/git-worktree'
import type { Repositories } from '../repositories'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerAgentWorkspaceHandlers(repos: Repositories): void {
  ipcMain.handle(IpcChannels.AGENT_WORKSPACES_LIST, () => {
    return repos.agentWorkspaces.list()
  })

  ipcMain.handle(IpcChannels.AGENT_WORKSPACES_CREATE, async (_event, raw: unknown) => {
    const input = CreateAgentWorkspaceInputSchema.parse(raw)
    const repoName = repoNameFromPath(input.repoPath)
    const worktreePath = worktreePathFor(input.repoPath, input.branch)

    // Create the worktree first — never persist a row for a worktree that
    // doesn't actually exist on disk.
    await addWorktree(input.repoPath, input.branch, worktreePath)

    const columnId = input.columnId ?? repos.agentBoardColumns.list()[0]?.id ?? null
    return repos.agentWorkspaces.create({ ...input, repoName, worktreePath, columnId })
  })

  ipcMain.handle(IpcChannels.AGENT_WORKSPACES_UPDATE, (_event, id: unknown, input: unknown) => {
    return requireEntity(
      repos.agentWorkspaces.update(
        IdSchema.parse(id),
        UpdateAgentWorkspaceInputSchema.parse(input)
      ),
      'AgentWorkspace'
    )
  })

  ipcMain.handle(IpcChannels.AGENT_WORKSPACES_DELETE, async (_event, id: unknown) => {
    const workspaceId = IdSchema.parse(id)
    const workspace = repos.agentWorkspaces.get(workspaceId)
    if (!workspace) return

    await removeWorktree(workspace.repoPath, workspace.worktreePath)
    repos.agentWorkspaces.delete(workspaceId)
  })

  ipcMain.handle(IpcChannels.AGENT_WORKSPACES_PICK_REPO, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'Selecionar repositório',
      properties: ['openDirectory' as const, 'showHiddenFiles' as const]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    IpcChannels.AGENT_WORKSPACES_CHECK_BRANCH,
    async (_event, repoPath: unknown, branch: unknown) => {
      return branchExists(String(repoPath), String(branch))
    }
  )

  ipcMain.handle(IpcChannels.AGENT_BOARD_COLUMNS_LIST, () => {
    return repos.agentBoardColumns.list()
  })

  ipcMain.handle(IpcChannels.AGENT_BOARD_COLUMNS_CREATE, (_event, raw: unknown) => {
    return repos.agentBoardColumns.create(CreateAgentBoardColumnInputSchema.parse(raw))
  })

  ipcMain.handle(IpcChannels.AGENT_BOARD_COLUMNS_UPDATE, (_event, id: unknown, input: unknown) => {
    return requireEntity(
      repos.agentBoardColumns.update(
        IdSchema.parse(id),
        UpdateAgentBoardColumnInputSchema.parse(input)
      ),
      'AgentBoardColumn'
    )
  })

  ipcMain.handle(IpcChannels.AGENT_BOARD_COLUMNS_DELETE, (_event, id: unknown) => {
    repos.agentBoardColumns.delete(IdSchema.parse(id))
  })
}
