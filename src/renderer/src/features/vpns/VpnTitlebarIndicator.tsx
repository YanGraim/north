import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Switch } from '@renderer/components/ui/switch'
import { useDisconnectVpn, useVpnProfiles, useVpnStates } from '@renderer/hooks/use-vpn'
import { formatRelativeDate } from '@renderer/lib/connection-ui'
import { cn } from '@renderer/lib/utils'
import { summarizeVpns } from '@renderer/lib/vpn-ui'
import { ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useVpnConnect } from './use-vpn-connect'
import { VpnDot, VpnStatusLabel } from './VpnStatus'

/** Titlebar pill + popover with a switch per VPN — the in-app replacement for the FortiClient tray icon. */
export function VpnTitlebarIndicator(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: profiles = [] } = useVpnProfiles()
  const { data: states = [] } = useVpnStates()
  const { connect } = useVpnConnect()
  const disconnect = useDisconnectVpn()
  const [open, setOpen] = useState(false)

  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.name])), [profiles])
  const summary = summarizeVpns(states, names)
  const label =
    summary.label ??
    (summary.count > 1
      ? t('vpn.indicator.many', { count: summary.count })
      : t('vpn.indicator.none'))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t('vpn.indicator.aria')}: ${label}`}
          data-testid="vpn-indicator"
          data-tone={summary.tone}
          className={cn(
            'no-drag inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            summary.tone === 'idle'
              ? 'border-border text-muted hover:text-foreground'
              : 'border-border bg-surface-elevated/60 text-foreground'
          )}
        >
          {summary.tone === 'idle' ? (
            <ShieldCheck className="size-3.5" aria-hidden />
          ) : (
            <VpnDot tone={summary.tone} />
          )}
          <span className="max-w-32 truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="vpn-popover">
        {profiles.length === 0 ? (
          <p className="p-3 text-xs text-muted">{t('vpn.indicator.empty')}</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-auto">
            {profiles.map((p) => {
              const state = states.find((s) => s.profileId === p.id)
              const on = ['connected', 'connecting', 'reconnecting'].includes(state?.status ?? '')
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2"
                  data-testid="vpn-popover-item"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{p.name}</p>
                    <div className="flex items-center gap-2" aria-live="polite">
                      <VpnStatusLabel state={state} />
                      {state?.status === 'connected' && state.localIp ? (
                        <span className="font-mono text-[11px] text-muted">
                          {state.localIp} · {formatRelativeDate(state.since)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Switch
                    checked={on}
                    aria-label={t('vpn.actions.toggle', { name: p.name })}
                    data-testid="vpn-popover-switch"
                    onCheckedChange={(checked) => {
                      if (checked) void connect(p.id)
                      else disconnect.mutate(p.id)
                    }}
                  />
                </li>
              )
            })}
          </ul>
        )}
        <div className="border-t border-border p-2">
          <Link
            to="/vpns"
            onClick={() => setOpen(false)}
            className="block rounded px-2 py-1 text-xs text-accent hover:underline"
          >
            {t('vpn.manage')}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
