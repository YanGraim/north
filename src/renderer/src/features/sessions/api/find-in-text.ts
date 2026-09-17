export type TextMatch = { from: number; to: number }

/** Case-insensitive, non-overlapping occurrences of `query` in `text`, left to right. */
export function findMatches(text: string, query: string): TextMatch[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const haystack = text.toLowerCase()
  const matches: TextMatch[] = []
  let from = 0
  for (;;) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) break
    matches.push({ from: index, to: index + needle.length })
    from = index + needle.length
  }
  return matches
}

/** Cyclic next/prev index into `matches` relative to `current` (-1 when there are no matches). */
export function stepMatchIndex(
  matchCount: number,
  current: number,
  direction: 'next' | 'prev'
): number {
  if (matchCount === 0) return -1
  if (current < 0) return direction === 'next' ? 0 : matchCount - 1
  if (direction === 'next') return (current + 1) % matchCount
  return (current - 1 + matchCount) % matchCount
}
