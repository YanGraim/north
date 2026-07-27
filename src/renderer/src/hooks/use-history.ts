import { queryKeys } from '@renderer/lib/query-keys'
import type {
  ConnectionHistoryEntry,
  ListHistoryFilter,
  RecordConnectionInput
} from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useConnectionHistory(
  filter?: ListHistoryFilter
): UseQueryResult<ConnectionHistoryEntry[], Error> {
  return useQuery({
    queryKey: queryKeys.history.list(filter),
    queryFn: () => window.north.history.list(filter)
  })
}

export function useRecordConnection(): UseMutationResult<
  ConnectionHistoryEntry,
  Error,
  RecordConnectionInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.history.record(input),
    onSuccess: async (_entry, input) => {
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.connections.detail(input.connectionId)
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
    }
  })
}
