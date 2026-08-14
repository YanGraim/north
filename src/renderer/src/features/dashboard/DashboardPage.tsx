import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useAccesses } from '@renderer/hooks/use-accesses'
import { connectionDisplayIcon, formatRelativeDate } from '@renderer/lib/connection-ui'
import { queryKeys } from '@renderer/lib/query-keys'
import { useCommandPaletteStore } from '@renderer/stores/command-palette-store'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { openConnectionSession, sessionKindForProtocol } from '@renderer/stores/sessions-store'
import type { Access, Connection, ConnectionHistoryEntry, StatsOverview } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import {
  Clock3,
  Database,
  LayoutDashboard,
  Plus,
  Search,
  Server,
  Star,
  UserPlus,
  Zap
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const ACTIVITY_LIMIT = 12

function useStatsOverview() {
  return useQuery({
    queryKey: queryKeys.stats.overview,
    queryFn: () => window.north.stats.overview()
  })
}

export function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate()
  const setPaletteOpen = useCommandPaletteStore((s) => s.setOpen)
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const { data, isLoading, isError } = useStatsOverview()
  const { data: accesses = [] } = useAccesses()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium text-foreground">{greeting}</h1>
            <p className="mt-0.5 text-xs text-muted">Workspace de infraestrutura</p>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex min-w-64 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
            aria-label="Abrir busca"
          >
            <Search className="size-3.5 shrink-0" />
            <span className="flex-1">Buscar conexões…</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {['a', 'b', 'c'].map((id) => (
              <Skeleton key={id} className="h-16 w-full" />
            ))}
          </div>
        ) : null}

        {isError ? (
          <p className="text-sm text-muted">Não foi possível carregar as estatísticas.</p>
        ) : null}

        {data ? (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <StatChip label="Clientes" value={data.totals.clients} to="/connections" />
                <StatChip label="Conexões" value={data.totals.connections} to="/connections" />
                <StatChip label="Favoritos" value={data.totals.favorites} to="/favorites" />
              </div>
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm">
                      <Plus className="size-3.5" />
                      Nova conexão
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => openDialog({ type: 'connection', mode: 'create' })}
                    >
                      <Server className="size-3.5" />
                      Servidor
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        openDialog({ type: 'access', mode: 'create', accessType: 'database' })
                      }
                    >
                      <Database className="size-3.5" />
                      Banco
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => openDialog({ type: 'client', mode: 'create' })}
                >
                  <UserPlus className="size-3.5" />
                  Novo cliente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/connections')}
                >
                  Ver conexões
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-rows-4 gap-4 lg:grid-cols-2 lg:grid-rows-2">
              <Widget title="Favoritos" icon={Star} empty="Nenhum favorito ainda">
                {data.favorites.map((c) => (
                  <ConnectionRow key={c.id} connection={c} />
                ))}
              </Widget>

              <Widget title="Recentes" icon={Clock3} empty="Sem acessos recentes">
                {data.recent.map((c) => (
                  <ConnectionRow key={c.id} connection={c} />
                ))}
              </Widget>

              <Widget title="Mais usados" icon={Zap} empty="Ainda sem estatísticas de uso">
                {data.mostUsed.map((c) => (
                  <ConnectionRow key={c.id} connection={c} meta={`${c.accessCount} acessos`} />
                ))}
              </Widget>

              <Widget title="Atividade" icon={LayoutDashboard} empty="Histórico vazio">
                {data.activity.slice(0, ACTIVITY_LIMIT).map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} overview={data} accesses={accesses} />
                ))}
              </Widget>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatChip({
  label,
  value,
  to
}: {
  label: string
  value: number
  to: string
}): React.JSX.Element {
  return (
    <Link
      to={to}
      className="min-w-28 rounded-md border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-elevated"
    >
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg text-foreground">{value}</p>
    </Link>
  )
}

function Widget({
  title,
  icon: Icon,
  empty,
  children
}: {
  title: string
  icon: typeof Star
  empty: string
  children: React.ReactNode
}): React.JSX.Element {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]
  const hasItems = items.some(Boolean)

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="size-3.5 text-muted" />
        <h2 className="text-xs font-medium text-foreground">{title}</h2>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="divide-y divide-border">
          {hasItems ? children : <li className="px-3 py-4 text-sm text-muted">{empty}</li>}
        </ul>
      </ScrollArea>
    </section>
  )
}

function ConnectionRow({
  connection,
  meta
}: {
  connection: Connection
  meta?: string
}): React.JSX.Element {
  const Icon = connectionDisplayIcon(connection)
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-elevated/60"
        onClick={() =>
          void openConnectionSession(connection.id, {
            title: connection.name,
            protocol: connection.protocol,
            sessionKind: sessionKindForProtocol(connection.protocol),
            username: connection.username,
            host: connection.host
          }).catch(() => undefined)
        }
      >
        <Icon className="size-3.5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{connection.name}</p>
          <p className="truncate font-mono text-[11px] text-muted">
            {connection.host}:{connection.port}
            {meta ? ` · ${meta}` : ''}
          </p>
        </div>
        <Badge variant="outline" className="uppercase">
          {connection.protocol}
        </Badge>
      </button>
    </li>
  )
}

function ActivityRow({
  entry,
  overview,
  accesses
}: {
  entry: ConnectionHistoryEntry
  overview: StatsOverview
  accesses: Access[]
}): React.JSX.Element {
  const connection =
    overview.recent.find((c) => c.id === entry.connectionId) ??
    overview.mostUsed.find((c) => c.id === entry.connectionId) ??
    overview.favorites.find((c) => c.id === entry.connectionId)
  const access = entry.accessId ? accesses.find((item) => item.id === entry.accessId) : undefined

  const href = entry.accessId
    ? `/connections?access=${entry.accessId}`
    : `/connections?connection=${entry.connectionId}`
  const name = entry.accessId ? (access?.name ?? 'Banco') : (connection?.name ?? 'Conexão')

  return (
    <li>
      <Link
        to={href}
        className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-surface-elevated/60"
      >
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{name}</p>
          <p className="font-mono text-[11px] text-muted">
            {formatRelativeDate(entry.connectedAt)}
            {entry.durationMs != null ? ` · ${formatDuration(entry.durationMs)}` : ''}
          </p>
        </div>
        <Badge variant={entry.success ? 'default' : 'outline'}>
          {entry.success ? 'ok' : 'erro'}
        </Badge>
      </Link>
    </li>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms % 60_000) / 1000)
  return `${mins}m ${secs}s`
}
