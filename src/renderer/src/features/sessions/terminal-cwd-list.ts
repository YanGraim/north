import type { ListDirectoryResult } from '@shared/lib/list-directory'
import type { RemoteEntry } from '@shared/protocols'

export class StaleDirectoryListError extends Error {
  constructor() {
    super('stale')
    this.name = 'StaleDirectoryListError'
  }
}

export class DirectoryListFailedError extends Error {
  constructor() {
    super('list-failed')
    this.name = 'DirectoryListFailedError'
  }
}

export function isStaleDirectoryListError(error: unknown): boolean {
  return error instanceof Error && error.name === 'StaleDirectoryListError'
}

/**
 * Drops a listing that belongs to a directory the shell has already left.
 * A failed result becomes a local error so the pane can show the i18n copy.
 */
export function acceptDirectoryEntries(
  requested: string,
  current: string | null,
  result: ListDirectoryResult
): RemoteEntry[] {
  if (requested !== current) throw new StaleDirectoryListError()
  if (!result.ok) throw new DirectoryListFailedError()
  return result.entries
}

export async function listTerminalCwd(
  sessionId: string,
  requested: string,
  current: string | null
): Promise<RemoteEntry[]> {
  const result = await window.north.sessions.listDirectory({ sessionId, path: requested })
  return acceptDirectoryEntries(requested, current, result)
}
