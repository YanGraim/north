import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useRecentConnectionHealthEvents } from '@renderer/hooks/use-connection-health'
import { useConnections } from '@renderer/hooks/use-connections'
import { formatRelativeDate } from '@renderer/lib/connection-ui'
import { ActivitySquare, ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'

const DAY_MS = 24 * 60 * 60 * 1000
const RECENT_LIMIT = 100
const LIST_LIMIT = 15

/** Global feed of monitored-connection status transitions — mirrors RecentUpdatesWidget's shape. */
export function ConnectionHealthWidget(): React.JSX.Element | null {
  const { data: events = [] } = useRecentConnectionHealthEvents(RECENT_LIMIT)
  const { data: connections = [] } = useConnections()

  const connectionNames = useMemo(
    () => new Map(connections.map((c) => [c.id, c.name])),
    [connections]
  )

  if (events.length === 0) return null

  const now = Date.now()
  const todayDowns = events.filter(
    (e) => e.newStatus === 'down' && new Date(e.occurredAt).getTime() >= now - DAY_MS
  ).length
  const weekDowns = events.filter(
    (e) => e.newStatus === 'down' && new Date(e.occurredAt).getTime() >= now - 7 * DAY_MS
  ).length
  const currentlyDown = new Map<string, boolean>()
  for (const event of events) {
    if (!currentlyDown.has(event.connectionId)) {
      currentlyDown.set(event.connectionId, event.newStatus === 'down')
    }
  }
  const downCount = [...currentlyDown.values()].filter(Boolean).length

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <ActivitySquare className="size-3.5 text-muted" />
        <h2 className="text-xs font-medium text-foreground">Monitoramento</h2>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-muted">
          {downCount > 0 ? (
            <span className="font-medium text-red-500">{downCount} fora do ar agora</span>
          ) : (
            <span className="font-medium text-emerald-500">tudo no ar</span>
          )}
          <span>
            <span className="font-medium text-foreground">{todayDowns}</span> queda
            {todayDowns === 1 ? '' : 's'} hoje
          </span>
          <span>
            <span className="font-medium text-foreground">{weekDowns}</span> na semana
          </span>
        </span>
      </header>
      <ScrollArea className="min-h-0 flex-1" style={{ maxHeight: 220 }}>
        <ul className="space-y-1.5 p-3">
          {events.slice(0, LIST_LIMIT).map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
            >
              {event.newStatus === 'up' ? (
                <ArrowUp className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
              ) : (
                <ArrowDown className="size-3.5 shrink-0 text-red-500" aria-hidden />
              )}
              <span className="text-muted">{formatRelativeDate(event.occurredAt)}</span>
              <span className="truncate text-foreground">
                {connectionNames.get(event.connectionId) ?? 'Conexão'}
              </span>
              <span className="ml-auto shrink-0 text-muted">
                {event.newStatus === 'up' ? 'voltou ao ar' : 'ficou indisponível'}
              </span>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </section>
  )
}
