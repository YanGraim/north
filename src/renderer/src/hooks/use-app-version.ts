import { useQuery, type UseQueryResult } from '@tanstack/react-query'

export function useAppVersion(): UseQueryResult<string, Error> {
  return useQuery({
    queryKey: ['app', 'version'],
    queryFn: () => window.north.getVersion()
  })
}
