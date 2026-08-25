import { hasEnvironmentContext } from '@renderer/lib/environment-color'

export type OrgContext = {
  clientName: string | null
  environmentName: string | null
  environmentColor: string | null
}

/**
 * Resolve client + environment from a group (preferred) or a connection.
 * Prefer groupId so callers that lack `connections.get` still hydrate.
 */
export async function resolveOrgContext(input: {
  groupId?: string | null
  connectionId?: string | null
}): Promise<OrgContext | null> {
  let groupId = input.groupId ?? null

  if (!groupId && input.connectionId) {
    const connection = await window.north.connections.get(input.connectionId)
    groupId = connection?.groupId ?? null
  }

  if (!groupId) return null

  const group = await window.north.groups.get(groupId)
  if (!group) return null

  const environment = await window.north.environments.get(group.environmentId)
  if (!environment) return null

  const client = await window.north.clients.get(environment.clientId)
  return {
    clientName: client?.name ?? null,
    environmentName: environment.name,
    environmentColor: environment.color
  }
}

/** Resolve nome e cor do ambiente de uma conexão. */
export async function resolveConnectionEnvironment(
  connectionId: string
): Promise<{ name: string; color: string | null } | null> {
  const ctx = await resolveOrgContext({ connectionId })
  if (!ctx?.environmentName) return null
  return { name: ctx.environmentName, color: ctx.environmentColor }
}

/** @deprecated Prefer resolveConnectionEnvironment */
export async function resolveConnectionEnvironmentName(
  connectionId: string
): Promise<string | null> {
  const resolved = await resolveConnectionEnvironment(connectionId)
  return resolved?.name ?? null
}

/** Folder chip for a workflow run: client (or connection), with env name if the badge is hidden. */
export function workflowRunFolderLabel(
  clientName: string | null | undefined,
  environmentName: string | null | undefined,
  connectionName?: string | null
): string {
  const client = clientName?.trim() || connectionName?.trim() || ''
  const env = environmentName?.trim() || ''
  if (env && !hasEnvironmentContext(env)) {
    return client ? `${client} · ${env}` : env
  }
  return client
}
