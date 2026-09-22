import { Switch } from '@renderer/components/ui/switch'
import { DetailSection } from '@renderer/features/connections/DetailSection'
import {
  useConnectionHealthEvents,
  useConnectionMonitor,
  useSetConnectionMonitoring
} from '@renderer/hooks/use-connection-health'
import { formatRelativeDate } from '@renderer/lib/connection-ui'
import { cn } from '@renderer/lib/utils'
import { ArrowDown, ArrowUp } from 'lucide-react'

type ConnectionHealthSectionProps = {
  connectionId: string
}

/**
 * Opt-in TCP uptime monitor for one Connection — toggle + current status +
 * a short transition history. Only Connections (SSH/RDP/VNC/FTP/SFTP/Telnet)
 * are monitorable; database Access isn't in this first cut.
 */
export function ConnectionHealthSection({
  connectionId
}: ConnectionHealthSectionProps): React.JSX.Element {
  const monitor = useConnectionMonitor(connectionId)
  const setMonitoring = useSetConnectionMonitoring()
  const { data: events = [] } = useConnectionHealthEvents(monitor?.enabled ? connectionId : null)
  const enabled = monitor?.enabled ?? false

  return (
    <DetailSection
      title="Monitoramento"
      action={
        <div className="flex items-center gap-2">
          {enabled ? <StatusBadge status={monitor?.lastStatus ?? null} /> : null}
          <Switch
            checked={enabled}
            onCheckedChange={(next) => setMonitoring.mutate({ connectionId, enabled: next })}
            aria-label="Monitorar disponibilidade"
          />
        </div>
      }
    >
      {!enabled ? (
        <p className="text-xs text-muted">
          Desligado — ligue pra checar se essa conexão está respondendo periodicamente e ser avisado
          se ela cair.
        </p>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted">
          {monitor?.lastCheckedAt
            ? `Última checagem ${formatRelativeDate(monitor.lastCheckedAt)}, sem quedas registradas.`
            : 'Primeira checagem ainda não rodou.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {events.slice(0, 10).map((event) => (
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
              <span className="text-foreground">
                {event.newStatus === 'up' ? 'voltou ao ar' : 'ficou indisponível'}
              </span>
              {event.errorMessage ? (
                <span className="truncate text-muted">— {event.errorMessage}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  )
}

function StatusBadge({ status }: { status: 'up' | 'down' | null }): React.JSX.Element {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-[11px]',
        status === 'up' && 'text-emerald-500',
        status === 'down' && 'text-red-500',
        status === null && 'text-muted'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'up' && 'bg-emerald-500',
          status === 'down' && 'bg-red-500',
          status === null && 'bg-muted'
        )}
        aria-hidden
      />
      {status === 'up' ? 'No ar' : status === 'down' ? 'Fora do ar' : 'Aguardando'}
    </span>
  )
}
