import type { ClaudeUsage } from '@shared/protocols'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'

/**
 * Polls Claude Code's own token usage for an agent-workspace session — main
 * resolves it from the transcript Claude Code writes to disk (null for any
 * non-`claude` session, or before Claude Code has written anything yet).
 */
export function useClaudeUsage(
  sessionId: string | undefined,
  enabled: boolean
): UseQueryResult<ClaudeUsage | null, Error> {
  return useQuery({
    queryKey: ['claude-usage', sessionId],
    queryFn: () => window.north.sessions.getClaudeUsage(sessionId as string),
    enabled: enabled && Boolean(sessionId),
    refetchInterval: 5000,
    staleTime: 0
  })
}
