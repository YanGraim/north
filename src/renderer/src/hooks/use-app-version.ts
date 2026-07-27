import { queryKeys } from '@renderer/lib/query-keys'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'

export function useAppVersion(): UseQueryResult<string, Error> {
  return useQuery({
    queryKey: queryKeys.app.version,
    queryFn: () => window.north.getVersion()
  })
}
