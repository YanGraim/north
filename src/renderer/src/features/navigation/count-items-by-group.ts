/** Counts connections + accesses per group for the client tree badges. */
export function countItemsByGroup(
  connections: readonly { groupId: string }[],
  accesses: readonly { groupId: string }[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const connection of connections) {
    counts.set(connection.groupId, (counts.get(connection.groupId) ?? 0) + 1)
  }
  for (const access of accesses) {
    counts.set(access.groupId, (counts.get(access.groupId) ?? 0) + 1)
  }
  return counts
}
