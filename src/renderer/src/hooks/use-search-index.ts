import { queryKeys } from '@renderer/lib/query-keys'
import type { SearchIndexItem } from '@shared/types'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'

export function useSearchIndex(): UseQueryResult<SearchIndexItem[], Error> {
  return useQuery({
    queryKey: queryKeys.search.index,
    queryFn: () => window.north.search.index(),
    staleTime: 30_000
  })
}
