import type {
  Access,
  AccessType,
  Connection,
  ConnectionProtocol,
  DatabaseEngine
} from '@shared/types'

export type GroupTreeLeaf =
  | {
      kind: 'connection'
      id: string
      name: string
      groupId: string
      protocol: ConnectionProtocol
      icon: string | null
    }
  | {
      kind: 'access'
      id: string
      name: string
      groupId: string
      accessType: AccessType
      engine: DatabaseEngine | null
      icon: string | null
    }

export function listGroupLeaves(
  connections: readonly Connection[],
  accesses: readonly Access[],
  groupId: string
): GroupTreeLeaf[] {
  const leaves: GroupTreeLeaf[] = []

  for (const connection of connections) {
    if (connection.groupId !== groupId) continue
    leaves.push({
      kind: 'connection',
      id: connection.id,
      name: connection.name,
      groupId: connection.groupId,
      protocol: connection.protocol,
      icon: connection.icon
    })
  }

  for (const access of accesses) {
    if (access.groupId !== groupId) continue
    leaves.push({
      kind: 'access',
      id: access.id,
      name: access.name,
      groupId: access.groupId,
      accessType: access.type,
      engine: access.engine,
      icon: access.icon
    })
  }

  return leaves.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function findGroupIdForSelectedItem(
  connections: readonly Pick<Connection, 'id' | 'groupId'>[],
  accesses: readonly Pick<Access, 'id' | 'groupId'>[],
  connectionId: string | null,
  accessId: string | null
): string | null {
  if (connectionId) {
    return connections.find((item) => item.id === connectionId)?.groupId ?? null
  }
  if (accessId) {
    return accesses.find((item) => item.id === accessId)?.groupId ?? null
  }
  return null
}
