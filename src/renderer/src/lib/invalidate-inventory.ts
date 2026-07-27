import { queryKeys } from '@renderer/lib/query-keys'
import type { QueryClient } from '@tanstack/react-query'

/** Invalida o índice de busca fuzzy após mutações de inventário. */
export async function invalidateSearchIndex(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.search.index })
}
