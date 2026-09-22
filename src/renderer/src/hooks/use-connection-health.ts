import { queryKeys } from '@renderer/lib/query-keys'
import type { ConnectionHealthEvent, ConnectionMonitor } from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useEffect } from 'react'

/** Every connection with monitoring configured (enabled or not) — live-updated on status changes. */
export function useConnectionMonitors(): UseQueryResult<ConnectionMonitor[], Error> {
  const queryClient = useQueryClient()

  useEffect(() => {
    return window.north.connectionMonitors.onHealthChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.connectionMonitors.list() })
    })
  }, [queryClient])

  return useQuery({
    queryKey: queryKeys.connectionMonitors.list(),
    queryFn: () => window.north.connectionMonitors.list()
  })
}

/** This connection's monitor, if any — `undefined` means "never toggled", not "off". */
export function useConnectionMonitor(
  connectionId: string | null | undefined
): ConnectionMonitor | undefined {
  const { data: monitors = [] } = useConnectionMonitors()
  return connectionId ? monitors.find((m) => m.connectionId === connectionId) : undefined
}

export function useSetConnectionMonitoring(): UseMutationResult<
  ConnectionMonitor,
  Error,
  { connectionId: string; enabled: boolean }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, enabled }) =>
      window.north.connectionMonitors.setEnabled(connectionId, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.connectionMonitors.list() })
    }
  })
}

/** Status-transition history for one connection, newest first. */
export function useConnectionHealthEvents(
  connectionId: string | null | undefined
): UseQueryResult<ConnectionHealthEvent[], Error> {
  const queryClient = useQueryClient()

  useEffect(() => {
    return window.north.connectionMonitors.onHealthChanged((change) => {
      if (change.connectionId !== connectionId) return
      void queryClient.invalidateQueries({
        queryKey: queryKeys.connectionMonitors.events(connectionId as string)
      })
    })
  }, [connectionId, queryClient])

  return useQuery({
    queryKey: queryKeys.connectionMonitors.events(connectionId ?? ''),
    queryFn: () => window.north.connectionMonitors.listEvents(connectionId as string),
    enabled: Boolean(connectionId)
  })
}

/** Global transition feed across every connection — powers the Dashboard widget. */
export function useRecentConnectionHealthEvents(
  limit?: number
): UseQueryResult<ConnectionHealthEvent[], Error> {
  const queryClient = useQueryClient()

  useEffect(() => {
    return window.north.connectionMonitors.onHealthChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.connectionMonitors.recentEvents() })
    })
  }, [queryClient])

  return useQuery({
    queryKey: queryKeys.connectionMonitors.recentEvents(),
    queryFn: () => window.north.connectionMonitors.listRecentEvents(limit)
  })
}
