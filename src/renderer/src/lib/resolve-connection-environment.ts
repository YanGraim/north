/** Resolve nome e cor do ambiente de uma conexão. */
export async function resolveConnectionEnvironment(
  connectionId: string
): Promise<{ name: string; color: string | null } | null> {
  const connection = await window.north.connections.get(connectionId)
  if (!connection?.groupId) return null

  const group = await window.north.groups.get(connection.groupId)
  if (!group) return null

  const environment = await window.north.environments.get(group.environmentId)
  if (!environment) return null

  return { name: environment.name, color: environment.color }
}

/** @deprecated Prefer resolveConnectionEnvironment */
export async function resolveConnectionEnvironmentName(
  connectionId: string
): Promise<string | null> {
  const resolved = await resolveConnectionEnvironment(connectionId)
  return resolved?.name ?? null
}
