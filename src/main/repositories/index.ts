import type { SqliteDatabase } from '../database/connection'
import { AccessesRepository } from './accesses-repository'
import { AgentBoardColumnsRepository } from './agent-board-columns-repository'
import { AgentWorkspacesRepository } from './agent-workspaces-repository'
import { ApiCollectionsRepository } from './api-collections-repository'
import { ApiPresetsRepository } from './api-presets-repository'
import { ApiRequestHistoryRepository } from './api-request-history-repository'
import { ApiRequestsRepository } from './api-requests-repository'
import { ApiVariablesRepository } from './api-variables-repository'
import { ClientsRepository } from './clients-repository'
import { ConnectionDirectoryFavoritesRepository } from './connection-directory-favorites-repository'
import { ConnectionHealthEventsRepository } from './connection-health-events-repository'
import { ConnectionMonitorsRepository } from './connection-monitors-repository'
import { ConnectionSecretsRepository } from './connection-secrets-repository'
import { ConnectionsRepository } from './connections-repository'
import { CredentialsRepository } from './credentials-repository'
import { EnvironmentUpdatesRepository } from './environment-updates-repository'
import { EnvironmentsRepository } from './environments-repository'
import { GroupVariablesRepository } from './group-variables-repository'
import { GroupsRepository } from './groups-repository'
import { HistoryRepository } from './history-repository'
import { KnownHostsRepository } from './known-hosts-repository'
import { OrganizationKeyPathsRepository } from './organization-key-paths-repository'
import { OrganizationVpnChoicesRepository } from './organization-vpn-choices-repository'
import { OrganizationVpnLinksRepository } from './organization-vpn-links-repository'
import { TagsRepository } from './tags-repository'
import { VpnHistoryRepository } from './vpn-history-repository'
import { VpnProfilesRepository } from './vpn-profiles-repository'
import { VpnSecretsRepository } from './vpn-secrets-repository'
import { WorkflowRunsRepository } from './workflow-runs-repository'
import { WorkflowsRepository } from './workflows-repository'

export type Repositories = {
  clients: ClientsRepository
  environments: EnvironmentsRepository
  groups: GroupsRepository
  connections: ConnectionsRepository
  directoryFavorites: ConnectionDirectoryFavoritesRepository
  accesses: AccessesRepository
  agentWorkspaces: AgentWorkspacesRepository
  agentBoardColumns: AgentBoardColumnsRepository
  credentials: CredentialsRepository
  tags: TagsRepository
  history: HistoryRepository
  knownHosts: KnownHostsRepository
  groupVariables: GroupVariablesRepository
  workflows: WorkflowsRepository
  workflowRuns: WorkflowRunsRepository
  environmentUpdates: EnvironmentUpdatesRepository
  connectionSecrets: ConnectionSecretsRepository
  apiCollections: ApiCollectionsRepository
  apiRequests: ApiRequestsRepository
  apiVariables: ApiVariablesRepository
  apiRequestHistory: ApiRequestHistoryRepository
  apiPresets: ApiPresetsRepository
  connectionMonitors: ConnectionMonitorsRepository
  connectionHealthEvents: ConnectionHealthEventsRepository
  vpnProfiles: VpnProfilesRepository
  vpnSecrets: VpnSecretsRepository
  vpnHistory: VpnHistoryRepository
  organizationVpnLinks: OrganizationVpnLinksRepository
  organizationVpnChoices: OrganizationVpnChoicesRepository
  /** This person's SSH key path per organization connection. */
  organizationKeyPaths: OrganizationKeyPathsRepository
  /** Runs of an organization's workflows on this computer (REC-024). */
  organizationWorkflowRuns: WorkflowRunsRepository
  /** Git/sudo passwords those runs learned, per organization connection. */
  organizationConnectionSecrets: ConnectionSecretsRepository
}

export function createRepositories(db: SqliteDatabase): Repositories {
  return {
    clients: new ClientsRepository(db),
    environments: new EnvironmentsRepository(db),
    groups: new GroupsRepository(db),
    connections: new ConnectionsRepository(db),
    directoryFavorites: new ConnectionDirectoryFavoritesRepository(db),
    accesses: new AccessesRepository(db),
    agentWorkspaces: new AgentWorkspacesRepository(db),
    agentBoardColumns: new AgentBoardColumnsRepository(db),
    credentials: new CredentialsRepository(db),
    tags: new TagsRepository(db),
    history: new HistoryRepository(db),
    knownHosts: new KnownHostsRepository(db),
    groupVariables: new GroupVariablesRepository(db),
    workflows: new WorkflowsRepository(db),
    workflowRuns: new WorkflowRunsRepository(db),
    environmentUpdates: new EnvironmentUpdatesRepository(db),
    connectionSecrets: new ConnectionSecretsRepository(db),
    apiCollections: new ApiCollectionsRepository(db),
    apiRequests: new ApiRequestsRepository(db),
    apiVariables: new ApiVariablesRepository(db),
    apiRequestHistory: new ApiRequestHistoryRepository(db),
    apiPresets: new ApiPresetsRepository(db),
    connectionMonitors: new ConnectionMonitorsRepository(db),
    connectionHealthEvents: new ConnectionHealthEventsRepository(db),
    vpnProfiles: new VpnProfilesRepository(db),
    vpnSecrets: new VpnSecretsRepository(db),
    vpnHistory: new VpnHistoryRepository(db),
    organizationVpnLinks: new OrganizationVpnLinksRepository(db),
    organizationVpnChoices: new OrganizationVpnChoicesRepository(db),
    organizationKeyPaths: new OrganizationKeyPathsRepository(db),
    organizationWorkflowRuns: new WorkflowRunsRepository(db, 'organization_workflow_runs'),
    organizationConnectionSecrets: new ConnectionSecretsRepository(
      db,
      'organization_connection_secrets'
    )
  }
}

export {
  AccessesRepository,
  AgentBoardColumnsRepository,
  AgentWorkspacesRepository,
  ApiCollectionsRepository,
  ApiPresetsRepository,
  ApiRequestHistoryRepository,
  ApiRequestsRepository,
  ApiVariablesRepository,
  ClientsRepository,
  ConnectionHealthEventsRepository,
  ConnectionMonitorsRepository,
  ConnectionSecretsRepository,
  ConnectionsRepository,
  CredentialsRepository,
  EnvironmentsRepository,
  EnvironmentUpdatesRepository,
  GroupsRepository,
  GroupVariablesRepository,
  HistoryRepository,
  KnownHostsRepository,
  TagsRepository,
  WorkflowRunsRepository,
  WorkflowsRepository
}
