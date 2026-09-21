import type { EnvironmentUpdate } from '@shared/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const WEEKS_SHOWN = 12

export function weekStart(date: Date): number {
  const day = date.getUTCDay()
  const diff = (day + 6) % 7 // Monday-anchored week
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff)
  )
  return start.getTime()
}

export type WeeklyBucket = { weekStartMs: number; success: number; failed: number }

export function buildWeeklyBuckets(updates: EnvironmentUpdate[]): WeeklyBucket[] {
  const now = Date.now()
  const currentWeekStart = weekStart(new Date(now))
  const buckets: WeeklyBucket[] = []
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    buckets.push({ weekStartMs: currentWeekStart - i * WEEK_MS, success: 0, failed: 0 })
  }

  const oldestMs = buckets[0]?.weekStartMs ?? currentWeekStart
  for (const update of updates) {
    const ws = weekStart(new Date(update.startedAt))
    if (ws < oldestMs) continue
    const bucket = buckets.find((b) => b.weekStartMs === ws)
    if (!bucket) continue
    if (update.status === 'success') bucket.success++
    else bucket.failed++
  }
  return buckets
}

/** Hand-rolled SVG bar chart — updates per week, success (green) vs failed (red), no chart lib. */
export function UpdatesChart({ updates }: { updates: EnvironmentUpdate[] }): React.JSX.Element {
  const buckets = buildWeeklyBuckets(updates)
  const maxCount = Math.max(1, ...buckets.map((b) => b.success + b.failed))
  const barWidth = 14
  const gap = 6
  const chartHeight = 64
  const width = buckets.length * (barWidth + gap)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${chartHeight + 4}`}
      preserveAspectRatio="xMinYMin meet"
      role="img"
      aria-label="Atualizações por semana, últimos 90 dias"
      className="max-w-full"
    >
      {buckets.map((bucket) => {
        const total = bucket.success + bucket.failed
        const successHeight = total === 0 ? 0 : (bucket.success / maxCount) * chartHeight
        const failedHeight = total === 0 ? 0 : (bucket.failed / maxCount) * chartHeight
        const x = buckets.indexOf(bucket) * (barWidth + gap)
        const label = new Date(bucket.weekStartMs).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit'
        })
        return (
          <g key={bucket.weekStartMs}>
            <title>
              {`Semana de ${label}: ${bucket.success} sucesso(s), ${bucket.failed} falha(s)`}
            </title>
            <rect
              x={x}
              y={chartHeight - failedHeight}
              width={barWidth}
              height={failedHeight}
              className="fill-red-500"
              rx={1.5}
            />
            <rect
              x={x}
              y={chartHeight - failedHeight - successHeight}
              width={barWidth}
              height={successHeight}
              className="fill-emerald-500"
              rx={1.5}
            />
            {total === 0 ? (
              <rect
                x={x}
                y={chartHeight - 2}
                width={barWidth}
                height={2}
                className="fill-border"
                rx={1}
              />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/** Count of updates started since `sinceMs`. */
export function countSince(updates: EnvironmentUpdate[], sinceMs: number): number {
  return updates.filter((u) => new Date(u.startedAt).getTime() >= sinceMs).length
}
