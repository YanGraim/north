import { LOCAL_WORKSPACE_ID } from '@shared/types'

export { LOCAL_WORKSPACE_ID }

const PREFIX = /^\/w\/([^/?#]+)(\/[^?#]*)?/

/** Legacy unscoped aliases that pointed somewhere else before workspaces. */
const LEGACY_ALIASES: Record<string, string> = {
  '/': '/dashboard',
  '/help': '/settings/manual'
}

/** `/connections?x` → `/w/<id>/connections?x`. Already-scoped paths pass through. */
export function workspacePath(workspaceId: string, path: string): string {
  if (parseWorkspacePath(path)) return path
  let rest = path.startsWith('/') ? path : `/${path}`
  const split = rest.search(/[?#]/)
  const pathname = split === -1 ? rest : rest.slice(0, split)
  const suffix = split === -1 ? '' : rest.slice(split)
  rest = `${LEGACY_ALIASES[pathname] ?? pathname}${suffix}`
  return `/w/${encodeURIComponent(workspaceId)}${rest}`
}

export function parseWorkspacePath(
  pathname: string
): { workspaceId: string; innerPath: string } | null {
  const match = PREFIX.exec(pathname)
  if (!match) return null
  const inner = match[2] ?? '/'
  return { workspaceId: decodeURIComponent(match[1]), innerPath: inner === '' ? '/' : inner }
}

export function stripWorkspacePrefix(pathname: string): string {
  return parseWorkspacePath(pathname)?.innerPath ?? pathname
}

/** Where an old bookmark / deep link (pre-workspaces) should land. */
export function toLegacyRedirect(
  pathname: string,
  search: string,
  preferredWorkspaceId: string | null
): string {
  return workspacePath(preferredWorkspaceId ?? LOCAL_WORKSPACE_ID, `${pathname}${search}`)
}
