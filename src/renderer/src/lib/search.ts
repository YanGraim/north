import type { SearchIndexItem, SearchIndexKind } from '@shared/types'
import Fuse, { type FuseResult, type IFuseOptions } from 'fuse.js'

const FUSE_OPTIONS: IFuseOptions<SearchIndexItem> = {
  includeMatches: true,
  includeScore: true,
  threshold: 0.35,
  ignoreLocation: true,
  keys: [
    { name: 'name', weight: 0.4 },
    { name: 'host', weight: 0.25 },
    { name: 'url', weight: 0.2 },
    { name: 'username', weight: 0.15 },
    { name: 'database', weight: 0.15 },
    { name: 'clientName', weight: 0.15 },
    { name: 'tags', weight: 0.15 },
    { name: 'environmentName', weight: 0.1 },
    { name: 'groupName', weight: 0.1 },
    { name: 'owner', weight: 0.08 },
    { name: 'description', weight: 0.08 },
    { name: 'notes', weight: 0.08 }
  ]
}

export type SearchHit = {
  item: SearchIndexItem
  score: number | undefined
  matches: FuseResult<SearchIndexItem>['matches']
}

export function createSearchEngine(index: SearchIndexItem[]): Fuse<SearchIndexItem> {
  return new Fuse(index, FUSE_OPTIONS)
}

export function searchIndex(index: SearchIndexItem[], query: string): SearchHit[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const fuse = createSearchEngine(index)
  return fuse.search(trimmed).map((result) => ({
    item: result.item,
    score: result.score,
    matches: result.matches
  }))
}

export function filterByKind(hits: SearchHit[], kind: SearchIndexKind): SearchHit[] {
  return hits.filter((hit) => hit.item.kind === kind)
}

export function groupSearchHits(hits: SearchHit[]): Record<SearchIndexKind, SearchHit[]> {
  return {
    connection: filterByKind(hits, 'connection'),
    access: filterByKind(hits, 'access'),
    client: filterByKind(hits, 'client'),
    environment: filterByKind(hits, 'environment'),
    group: filterByKind(hits, 'group'),
    tag: filterByKind(hits, 'tag')
  }
}

/** Destaca trechos casados pelo Fuse (índices inclusivos). */
export function highlightMatches(
  text: string,
  indices: ReadonlyArray<readonly [number, number]> | undefined
): Array<{ text: string; matched: boolean }> {
  if (!indices || indices.length === 0) {
    return [{ text, matched: false }]
  }

  const parts: Array<{ text: string; matched: boolean }> = []
  let cursor = 0

  const sorted = [...indices].sort((a, b) => a[0] - b[0])
  for (const [start, end] of sorted) {
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start), matched: false })
    }
    parts.push({ text: text.slice(start, end + 1), matched: true })
    cursor = end + 1
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), matched: false })
  }

  return parts
}
