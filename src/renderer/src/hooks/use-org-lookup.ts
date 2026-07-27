import { useClients } from '@renderer/hooks/use-clients'
import { useEnvironments } from '@renderer/hooks/use-environments'
import { useGroups } from '@renderer/hooks/use-groups'
import type { Client, Environment, Group } from '@shared/types'
import { useCallback, useMemo } from 'react'

export type OrgPath = {
  client: Client | null
  environment: Environment | null
  group: Group | null
}

export function useOrgLookup(): {
  resolveGroup: (groupId: string) => OrgPath
  clients: Client[]
  environments: Environment[]
  groups: Group[]
  isLoading: boolean
} {
  const { data: clients = [], isLoading: clientsLoading } = useClients()
  const { data: environments = [], isLoading: envsLoading } = useEnvironments()
  const { data: groups = [], isLoading: groupsLoading } = useGroups()

  const indexes = useMemo(() => {
    const groupsById = new Map(groups.map((g) => [g.id, g]))
    const envsById = new Map(environments.map((e) => [e.id, e]))
    const clientsById = new Map(clients.map((c) => [c.id, c]))
    return { groupsById, envsById, clientsById }
  }, [clients, environments, groups])

  const resolveGroup = useCallback(
    (groupId: string): OrgPath => {
      const group = indexes.groupsById.get(groupId) ?? null
      const environment = group ? (indexes.envsById.get(group.environmentId) ?? null) : null
      const client = environment ? (indexes.clientsById.get(environment.clientId) ?? null) : null
      return { client, environment, group }
    },
    [indexes]
  )

  return {
    resolveGroup,
    clients,
    environments,
    groups,
    isLoading: clientsLoading || envsLoading || groupsLoading
  }
}
