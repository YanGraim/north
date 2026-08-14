import { IpcChannels } from '@shared/ipc'
import {
  CopyWorkflowInputSchema,
  CreateGroupVariableInputSchema,
  CreateWorkflowInputSchema,
  IdSchema,
  SetConnectionSecretInputSchema,
  StartWorkflowRunInputSchema,
  UpdateGroupVariableInputSchema,
  UpdateWorkflowInputSchema,
  WorkflowRunRespondInputSchema
} from '@shared/types'
import { ipcMain } from 'electron'
import { z } from 'zod'
import type { Repositories } from '../repositories'
import { broadcastWorkflowEvent, WorkflowService } from '../services/workflows/workflow-service'
import type { CredentialVault } from '../vault'

const LimitSchema = z.number().int().positive().max(100).optional()
const KindSchema = z.string().min(1)

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

let workflowService: WorkflowService | null = null

export function getWorkflowService(): WorkflowService {
  if (!workflowService) {
    throw new Error('WorkflowService not initialized')
  }
  return workflowService
}

export function registerWorkflowHandlers(repos: Repositories, vault: CredentialVault): void {
  workflowService = new WorkflowService(repos, vault, (runId, event) => {
    broadcastWorkflowEvent(IpcChannels.WORKFLOWS_RUN_EVENT, { runId, event })
  })

  const service = workflowService

  ipcMain.handle(IpcChannels.WORKFLOWS_LIST, (_e, groupId: unknown) => {
    return service.listWorkflows(IdSchema.parse(groupId))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_GET, (_e, id: unknown) => {
    return service.getWorkflow(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_CREATE, (_e, input: unknown) => {
    return service.createWorkflow(CreateWorkflowInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_COPY, (_e, input: unknown) => {
    const parsed = CopyWorkflowInputSchema.parse(input)
    return service.copyWorkflow(
      parsed.workflowId,
      parsed.targetGroupIds,
      parsed.allowDuplicateNames
    )
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_UPDATE, (_e, id: unknown, input: unknown) => {
    return requireEntity(
      service.updateWorkflow(IdSchema.parse(id), UpdateWorkflowInputSchema.parse(input)),
      'Workflow'
    )
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_DELETE, (_e, id: unknown) => {
    const workflowId = IdSchema.parse(id)
    if (!service.getWorkflow(workflowId)) {
      throw new Error('Workflow not found')
    }
    service.deleteWorkflow(workflowId)
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_LIST_VARIABLES, (_e, groupId: unknown) => {
    return service.listVariables(IdSchema.parse(groupId))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_CREATE_VARIABLE, (_e, input: unknown) => {
    return service.createVariable(CreateGroupVariableInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_UPDATE_VARIABLE, (_e, id: unknown, input: unknown) => {
    return requireEntity(
      service.updateVariable(IdSchema.parse(id), UpdateGroupVariableInputSchema.parse(input)),
      'GroupVariable'
    )
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_DELETE_VARIABLE, (_e, id: unknown) => {
    const variableId = IdSchema.parse(id)
    if (!repos.groupVariables.get(variableId)) {
      throw new Error('GroupVariable not found')
    }
    service.deleteVariable(variableId)
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_LIST_RUNS, (_e, groupId: unknown, limit?: unknown) => {
    return service.listRuns(IdSchema.parse(groupId), LimitSchema.parse(limit))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_GET_RUN, (_e, id: unknown) => {
    return service.getRun(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_RUN, (_e, input: unknown) => {
    return service.startRun(StartWorkflowRunInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_RESPOND, (_e, input: unknown) => {
    return service.respond(WorkflowRunRespondInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_CANCEL, (_e, runId: unknown) => {
    service.cancel(IdSchema.parse(runId))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_LIST_CONNECTION_SECRETS, (_e, connectionId: unknown) => {
    return service.listConnectionSecrets(IdSchema.parse(connectionId))
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_SET_CONNECTION_SECRET, (_e, input: unknown) => {
    const parsed = SetConnectionSecretInputSchema.parse(input)
    return service.setConnectionSecret(parsed.connectionId, parsed.kind, parsed.secret)
  })

  ipcMain.handle(
    IpcChannels.WORKFLOWS_DELETE_CONNECTION_SECRET,
    (_e, connectionId: unknown, kind: unknown) => {
      return service.deleteConnectionSecret(IdSchema.parse(connectionId), KindSchema.parse(kind))
    }
  )
}
