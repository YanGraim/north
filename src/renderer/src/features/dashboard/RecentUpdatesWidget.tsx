import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { UpdateRow } from '@renderer/features/workflows/EnvironmentUpdatesSection'
import { useClients } from '@renderer/hooks/use-clients'
import { useRecentEnvironmentUpdates } from '@renderer/hooks/use-environment-updates'
import { useEnvironments } from '@renderer/hooks/use-environments'
import { countSince, UpdatesChart } from '@renderer/lib/environment-updates-chart'
import { GitBranch } from 'lucide-react'
import { useMemo, useState } from 'react'

const DAY_MS = 24 * 60 * 60 * 1000
const RECENT_LIMIT = 100
const LIST_LIMIT = 15
const ALL_CLIENTS = '__all__'

export function RecentUpdatesWidget(): React.JSX.Element | null {
  const { data: allUpdates = [] } = useRecentEnvironmentUpdates(RECENT_LIMIT)
  const { data: environments = [] } = useEnvironments()
  const { data: clients = [] } = useClients()
  const [clientFilter, setClientFilter] = useState(ALL_CLIENTS)

  const { contextLabels, clientIdByEnvironment } = useMemo(() => {
    const clientsById = new Map(clients.map((c) => [c.id, c]))
    const labels = new Map<string, string>()
    const clientIds = new Map<string, string>()
    for (const environment of environments) {
      const client = clientsById.get(environment.clientId)
      labels.set(environment.id, client ? `${client.name} · ${environment.name}` : environment.name)
      clientIds.set(environment.id, environment.clientId)
    }
    return { contextLabels: labels, clientIdByEnvironment: clientIds }
  }, [environments, clients])

  const clientsWithUpdates = useMemo(() => {
    const ids = new Set(
      allUpdates.map((u) => clientIdByEnvironment.get(u.environmentId)).filter(Boolean)
    )
    return clients.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [allUpdates, clientIdByEnvironment, clients])

  const updates = useMemo(() => {
    if (clientFilter === ALL_CLIENTS) return allUpdates
    return allUpdates.filter((u) => clientIdByEnvironment.get(u.environmentId) === clientFilter)
  }, [allUpdates, clientFilter, clientIdByEnvironment])

  if (allUpdates.length === 0) return null

  const now = Date.now()
  const todayCount = countSince(updates, now - DAY_MS)
  const weekCount = countSince(updates, now - 7 * DAY_MS)

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <GitBranch className="size-3.5 text-muted" />
        <h2 className="text-xs font-medium text-foreground">Últimas atualizações</h2>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger
            className="ml-3 h-7 w-44 text-xs"
            data-testid="recent-updates-client-filter"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLIENTS}>Todos os clientes</SelectItem>
            {clientsWithUpdates.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-muted">
          <span>
            <span className="font-medium text-foreground">{todayCount}</span> hoje
          </span>
          <span>
            <span className="font-medium text-foreground">{weekCount}</span> esta semana
          </span>
        </span>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 p-3 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="flex items-center justify-center rounded-md border border-border bg-surface-elevated/30 p-3">
          <UpdatesChart updates={updates} />
        </div>
        <ScrollArea className="min-h-0" style={{ maxHeight: 220 }}>
          <ul className="space-y-1.5 pr-2">
            {updates.slice(0, LIST_LIMIT).map((update) => (
              <li key={update.id}>
                <UpdateRow update={update} contextLabel={contextLabels.get(update.environmentId)} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>
    </section>
  )
}
