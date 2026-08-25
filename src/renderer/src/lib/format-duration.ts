/** Compact duration for lists and run headers (`512 ms`, `51s`, `4m 12s`). */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms % 60_000) / 1000)
  return `${mins}m ${secs}s`
}
