import type { SqliteDatabase } from '../database/connection'
import { AccessesRepository } from './accesses-repository'
import { ApiCollectionsRepository } from './api-collections-repository'
import { ApiRequestHistoryRepository } from './api-request-history-repository'
import { ApiRequestsRepository } from './api-requests-repository'
import { ApiVariablesRepository } from './api-variables-repository'
import { ClientsRepository } from './clients-repository'
import { ConnectionSecretsRepository } from './connection-secrets-repository'
import { ConnectionsRepository } from './connections-repository'
import { CredentialsRepository } from './credentials-repository'
import { EnvironmentsRepository } from './environments-repository'
import { GroupVariablesRepository } from './group-variables-repository'
import { GroupsRepository } from './groups-repository'
import { HistoryRepository } from './history-repository'
import { KnownHostsRepository } from './known-hosts-repository'
import { TagsRepository } from './tags-repository'
import { WorkflowRunsRepository } from './workflow-runs-repository'
import { WorkflowsRepository } from './workflows-repository'

export type Repositories = {
  clients: ClientsRepository
  environments: EnvironmentsRepository
  groups: GroupsRepository
  connections: ConnectionsRepository
  accesses: AccessesRepository
  credentials: CredentialsRepository
  tags: TagsRepository
  history: HistoryRepository
  knownHosts: KnownHostsRepository
  groupVariables: GroupVariablesRepository
  workflows: WorkflowsRepository
  workflowRuns: WorkflowRunsRepository
  connectionSecrets: ConnectionSecretsRepository
  apiCollections: ApiCollectionsRepository
  apiRequests: ApiRequestsRepository
  apiVariables: ApiVariablesRepository
  apiRequestHistory: ApiRequestHistoryRepository
}

export function createRepositories(db: SqliteDatabase): Repositories {
  return {
    clients: new ClientsRepository(db),
    environments: new EnvironmentsRepository(db),
    groups: new GroupsRepository(db),
    connections: new ConnectionsRepository(db),
    accesses: new AccessesRepository(db),
    credentials: new CredentialsRepository(db),
    tags: new TagsRepository(db),
    history: new HistoryRepository(db),
    knownHosts: new KnownHostsRepository(db),
    groupVariables: new GroupVariablesRepository(db),
    workflows: new WorkflowsRepository(db),
    workflowRuns: new WorkflowRunsRepository(db),
    connectionSecrets: new ConnectionSecretsRepository(db),
    apiCollections: new ApiCollectionsRepository(db),
    apiRequests: new ApiRequestsRepository(db),
    apiVariables: new ApiVariablesRepository(db),
    apiRequestHistory: new ApiRequestHistoryRepository(db)
  }
}

export {
  AccessesRepository,
  ApiCollectionsRepository,
  ApiRequestHistoryRepository,
  ApiRequestsRepository,
  ApiVariablesRepository,
  ClientsRepository,
  ConnectionSecretsRepository,
  ConnectionsRepository,
  CredentialsRepository,
  EnvironmentsRepository,
  GroupsRepository,
  GroupVariablesRepository,
  HistoryRepository,
  KnownHostsRepository,
  TagsRepository,
  WorkflowRunsRepository,
  WorkflowsRepository
}
