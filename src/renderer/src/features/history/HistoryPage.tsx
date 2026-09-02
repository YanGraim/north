import { EmptyState } from '@renderer/components/EmptyState'
import { Badge } from '@renderer/components/ui/badge'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useAccesses } from '@renderer/hooks/use-accesses'
import { useConnections } from '@renderer/hooks/use-connections'
import { useConnectionHistory } from '@renderer/hooks/use-history'
import { formatDayHeading, formatRelativeDate } from '@renderer/lib/connection-ui'
import { formatDuration } from '@renderer/lib/format-duration'
import type { ConnectionHistoryEntry } from '@shared/types'
import { History } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

export function HistoryPage(): React.JSX.Element {
  const { data: entries = [], isLoading, isError } = useConnectionHistory({ limit: 200 })
  const { data: connections = [] } = useConnections()
  const { data: accesses = [] } = useAccesses()

  const targetName = useMemo(() => {
    const connectionsMap = new Map(connections.map((c) => [c.id, c.name]))
    const accessesMap = new Map(accesses.map((a) => [a.id, a.name]))
    return (entry: ConnectionHistoryEntry): string => {
      if (entry.accessId) return accessesMap.get(entry.accessId) ?? 'Acesso removido'
      if (entry.connectionId) return connectionsMap.get(entry.connectionId) ?? 'Conexão removida'
      return 'Sessão'
    }
  }, [connections, accesses])

  const groups = useMemo(() => groupByDay(entries), [entries])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-sm font-medium text-foreground">Histórico</h1>
        <p className="mt-0.5 text-xs text-muted">Acessos recentes agrupados por dia</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {['h1', 'h2', 'h3', 'h4', 'h5'].map((id) => (
              <Skeleton key={id} className="h-12 w-full" />
            ))}
          </div>
        ) : null}

        {isError ? (
          <EmptyState
            icon={History}
            title="Falha ao carregar histórico"
            description="Não foi possível obter os registros de acesso."
          />
        ) : null}

        {!isLoading && !isError && groups.length === 0 ? (
          <EmptyState
            icon={History}
            title="Histórico vazio"
            description="Os acessos registrados aparecerão aqui agrupados por dia."
          />
        ) : null}

        <div className="space-y-6 p-4">
          {groups.map((group) => (
            <section key={group.dayKey} className="space-y-2">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
                {group.label}
              </h2>
              <ul className="divide-y divide-border rounded-md border border-border">
                {group.items.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      to={
                        entry.accessId
                          ? `/connections?access=${entry.accessId}`
                          : `/connections?connection=${entry.connectionId}`
                      }
                      className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors motion-safe:duration-150 hover:bg-surface-elevated/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{targetName(entry)}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted">
                          {formatRelativeDate(entry.connectedAt)}
                          {entry.durationMs != null ? ` · ${formatDuration(entry.durationMs)}` : ''}
                        </p>
                      </div>
                      <Badge variant={entry.success ? 'default' : 'outline'}>
                        {entry.success ? 'ok' : 'falha'}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function groupByDay(entries: ConnectionHistoryEntry[]): Array<{
  dayKey: string
  label: string
  items: ConnectionHistoryEntry[]
}> {
  const map = new Map<string, ConnectionHistoryEntry[]>()

  for (const entry of entries) {
    const date = new Date(entry.connectedAt)
    const dayKey = Number.isNaN(date.getTime())
      ? entry.connectedAt
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const list = map.get(dayKey) ?? []
    list.push(entry)
    map.set(dayKey, list)
  }

  return Array.from(map.entries()).map(([dayKey, items]) => ({
    dayKey,
    label: formatDayHeading(items[0]?.connectedAt ?? dayKey),
    items
  }))
}
