import type { ListAccessesFilter, ListConnectionsFilter, ListHistoryFilter } from '@shared/types'

export const queryKeys = {
  app: {
    version: ['app', 'version'] as const,
    identity: ['app', 'identity'] as const
  },
  clients: {
    all: ['clients'] as const,
    detail: (id: string) => ['clients', id] as const
  },
  environments: {
    all: ['environments'] as const,
    byClient: (clientId?: string) => ['environments', { clientId }] as const,
    detail: (id: string) => ['environments', id] as const
  },
  groups: {
    all: ['groups'] as const,
    byEnvironment: (environmentId?: string) => ['groups', { environmentId }] as const,
    detail: (id: string) => ['groups', id] as const
  },
  connections: {
    all: ['connections'] as const,
    list: (filter?: ListConnectionsFilter) => ['connections', 'list', filter ?? {}] as const,
    detail: (id: string) => ['connections', id] as const
  },
  accesses: {
    all: ['accesses'] as const,
    list: (filter?: ListAccessesFilter) => ['accesses', 'list', filter ?? {}] as const,
    detail: (id: string) => ['accesses', id] as const
  },
  tags: {
    all: ['tags'] as const,
    forConnection: (connectionId: string) => ['tags', 'connection', connectionId] as const,
    forAccess: (accessId: string) => ['tags', 'access', accessId] as const
  },
  history: {
    list: (filter?: ListHistoryFilter) => ['history', filter ?? {}] as const
  },
  search: {
    index: ['search', 'index'] as const
  },
  stats: {
    overview: ['stats', 'overview'] as const
  },
  serial: {
    ports: ['serial', 'ports'] as const
  },
  vault: {
    available: ['vault', 'available'] as const,
    hasSecret: (credentialRef: string) => ['vault', 'has-secret', credentialRef] as const
  },
  workflows: {
    byGroup: (groupId: string) => ['workflows', 'group', groupId] as const,
    detail: (id: string) => ['workflows', id] as const,
    variables: (groupId: string) => ['workflows', 'variables', groupId] as const,
    runs: (groupId: string) => ['workflows', 'runs', groupId] as const,
    connectionSecrets: (connectionId: string) =>
      ['workflows', 'connection-secrets', connectionId] as const
  }
}
