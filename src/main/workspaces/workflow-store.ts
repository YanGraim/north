import type {
  CreateEnvironmentUpdateInput,
  CreateGroupVariableInput,
  CreateWorkflowInput,
  EnvironmentUpdate,
  GroupVariable,
  UpdateGroupVariableInput,
  UpdateWorkflowInput,
  Workflow
} from '@shared/types'
import type { Repositories } from '../repositories'
import type { ConnectionSecretsRepository } from '../repositories/connection-secrets-repository'
import type { WorkflowRunsRepository } from '../repositories/workflow-runs-repository'
import type { OrganizationClient } from './organization-client'

/**
 * Workflows of a workspace (REC-024). The definition, the group variables and
 * the environment updates follow the workspace: SQLite for the personal one,
 * the North Server for an organization. Runs and the git/sudo passwords they
 * learn always stay on this computer: each person runs with their own access.
 */
export interface WorkflowStore {
  workflows: {
    listByGroup(groupId: string): Promise<Workflow[]>
    get(id: string): Promise<Workflow | null>
    create(input: CreateWorkflowInput): Promise<Workflow>
    update(id: string, input: UpdateWorkflowInput): Promise<Workflow | null>
    delete(id: string): Promise<boolean>
  }
  variables: {
    listByGroup(groupId: string): Promise<GroupVariable[]>
    get(id: string): Promise<GroupVariable | null>
    create(input: CreateGroupVariableInput): Promise<GroupVariable>
    update(id: string, input: UpdateGroupVariableInput): Promise<GroupVariable | null>
    delete(id: string): Promise<boolean>
  }
  updates: {
    listByEnvironment(environmentId: string, limit?: number): Promise<EnvironmentUpdate[]>
    listRecent(limit?: number): Promise<EnvironmentUpdate[]>
    create(input: CreateEnvironmentUpdateInput): Promise<EnvironmentUpdate>
  }
  /** Local to this computer in both cases. */
  runs: WorkflowRunsRepository
  connectionSecrets: ConnectionSecretsRepository
  /** Whether a connection password learned by a run may also become the connection's own. */
  readonly ownsConnections: boolean
}

export function localWorkflowStore(repos: Repositories): WorkflowStore {
  return {
    workflows: {
      listByGroup: async (groupId) => repos.workflows.listByGroup(groupId),
      get: async (id) => repos.workflows.get(id),
      create: async (input) => repos.workflows.create(input),
      update: async (id, input) => repos.workflows.update(id, input),
      delete: async (id) => repos.workflows.delete(id)
    },
    variables: {
      listByGroup: async (groupId) => repos.groupVariables.listByGroup(groupId),
      get: async (id) => repos.groupVariables.get(id),
      create: async (input) => repos.groupVariables.create(input),
      update: async (id, input) => repos.groupVariables.update(id, input),
      delete: async (id) => repos.groupVariables.delete(id)
    },
    updates: {
      listByEnvironment: async (environmentId, limit) =>
        repos.environmentUpdates.listByEnvironment(environmentId, limit),
      listRecent: async (limit) => repos.environmentUpdates.listRecent(limit),
      create: async (input) => repos.environmentUpdates.create(input)
    },
    runs: repos.workflowRuns,
    connectionSecrets: repos.connectionSecrets,
    ownsConnections: true
  }
}

const v1 = '/api/v1'

export class RemoteWorkflowStore implements WorkflowStore {
  readonly runs: WorkflowRunsRepository
  readonly connectionSecrets: ConnectionSecretsRepository
  readonly ownsConnections = false

  constructor(
    private readonly api: OrganizationClient,
    local: Repositories
  ) {
    this.runs = local.organizationWorkflowRuns
    this.connectionSecrets = local.organizationConnectionSecrets
  }

  private async orNull<T>(call: Promise<T>): Promise<T | null> {
    try {
      return await call
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null
      throw error
    }
  }

  private async deleted(path: string): Promise<boolean> {
    return (await this.orNull(this.api.request('DELETE', path).then(() => true))) ?? false
  }

  readonly workflows: WorkflowStore['workflows'] = {
    listByGroup: (groupId) =>
      this.api.request<Workflow[]>('GET', `${v1}/workflows?groupId=${encodeURIComponent(groupId)}`),
    get: (id) => this.orNull(this.api.request<Workflow>('GET', `${v1}/workflows/${id}`)),
    create: (input) => this.api.request<Workflow>('POST', `${v1}/workflows`, input),
    update: (id, input) =>
      this.orNull(this.api.request<Workflow>('PATCH', `${v1}/workflows/${id}`, input)),
    delete: (id) => this.deleted(`${v1}/workflows/${id}`)
  }

  readonly variables: WorkflowStore['variables'] = {
    listByGroup: (groupId) =>
      this.api.request<GroupVariable[]>(
        'GET',
        `${v1}/group-variables?groupId=${encodeURIComponent(groupId)}`
      ),
    // The server has no single-variable read: a group's list is short.
    get: async () => null,
    create: (input) => this.api.request<GroupVariable>('POST', `${v1}/group-variables`, input),
    update: (id, input) =>
      this.orNull(this.api.request<GroupVariable>('PATCH', `${v1}/group-variables/${id}`, input)),
    delete: (id) => this.deleted(`${v1}/group-variables/${id}`)
  }

  readonly updates: WorkflowStore['updates'] = {
    listByEnvironment: (environmentId, limit = 200) =>
      this.api.request<EnvironmentUpdate[]>(
        'GET',
        `${v1}/environment-updates?environmentId=${encodeURIComponent(environmentId)}&limit=${limit}`
      ),
    listRecent: (limit = 100) =>
      this.api.request<EnvironmentUpdate[]>('GET', `${v1}/environment-updates?limit=${limit}`),
    create: (input) =>
      this.api.request<EnvironmentUpdate>('POST', `${v1}/environment-updates`, input)
  }
}
