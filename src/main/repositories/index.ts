import type { SqliteDatabase } from '../database/connection'
import { AccessesRepository } from './accesses-repository'
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
    connectionSecrets: new ConnectionSecretsRepository(db)
  }
}

export {
  AccessesRepository,
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
