import { useConnection } from '@renderer/hooks/use-connections'
import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { useCurrentWorkspace } from '@renderer/hooks/use-workspaces'
import { queryKeys } from '@renderer/lib/query-keys'
import { type Connection, FULL_ACCESS, type Permissions, permissionsFor } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

const NO_ACCESS = permissionsFor({
  role: 'member',
  grants: [],
  connectionGrants: [],
  accessGrants: [],
  teams: []
})

/**
 * What the user may do in the current workspace (ADR 0018 §7). The personal
 * workspace allows everything; an organization asks the server and hides
 * actions until it answers. The server still checks every call.
 */
export function usePermissions(): Permissions {
  const organization = useCurrentWorkspace()?.kind === 'organization'
  const { data } = useQuery({
    queryKey: queryKeys.workspaces.access,
    queryFn: () => window.north.workspaces.access(),
    enabled: organization,
    staleTime: 60_000,
    refetchOnWindowFocus: true
  })
  return useMemo(() => {
    if (!organization) return permissionsFor(FULL_ACCESS)
    return data ? permissionsFor(data) : NO_ACCESS
  }, [organization, data])
}

/** Path of a connection in the tree, for `edit` / `revealPassword`. */
function useConnectionPath(connection: Pick<Connection, 'id' | 'groupId'> | undefined) {
  const { resolveGroup } = useOrgLookup()
  if (!connection?.groupId) return null
  const org = resolveGroup(connection.groupId)
  return {
    clientId: org.client?.id,
    environmentId: org.environment?.id,
    groupId: connection.groupId,
    connectionId: connection.id
  }
}

/** Whether the user may edit, duplicate or delete this connection. */
export function useCanEditConnection(connection: Pick<Connection, 'id' | 'groupId'>): boolean {
  const can = usePermissions()
  const path = useConnectionPath(connection ?? undefined)
  return path !== null && can.edit(path)
}

/** Whether the user may read or paste this connection's password (viewers may not). */
export function useCanRevealConnectionPassword(connectionId: string | null | undefined): boolean {
  const can = usePermissions()
  const { data: connection } = useConnection(connectionId ?? undefined)
  const path = useConnectionPath(connection ?? undefined)
  return path !== null && can.revealPassword(path)
}

/** Whether the user may create or change the group's workflows and variables (REC-024). */
export function useCanEditGroup(groupId: string | null | undefined): boolean {
  const can = usePermissions()
  const { resolveGroup } = useOrgLookup()
  if (!groupId) return false
  const org = resolveGroup(groupId)
  return can.edit({ clientId: org.client?.id, environmentId: org.environment?.id, groupId })
}
