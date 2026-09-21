import { queryKeys } from '@renderer/lib/query-keys'
import type { EnvironmentUpdate } from '@shared/types'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'

/** Git-tracked workflow update history for an environment, newest first. */
export function useEnvironmentUpdates(
  environmentId: string | null | undefined
): UseQueryResult<EnvironmentUpdate[], Error> {
  return useQuery({
    queryKey: queryKeys.environmentUpdates.list(environmentId ?? ''),
    queryFn: () => window.north.environmentUpdates.list(environmentId as string),
    enabled: Boolean(environmentId)
  })
}

/** Global Git-tracked update feed across every environment — powers the Dashboard widget. */
export function useRecentEnvironmentUpdates(
  limit?: number
): UseQueryResult<EnvironmentUpdate[], Error> {
  return useQuery({
    queryKey: queryKeys.environmentUpdates.recent(),
    queryFn: () => window.north.environmentUpdates.listRecent(limit)
  })
}
