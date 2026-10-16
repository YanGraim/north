import type { OpenVpnConfig } from '@shared/types'
import { useTranslation } from 'react-i18next'

/** Human summary of an imported .ovpn — what the file demands, before asking for anything. */
export function OvpnSummary({ config }: { config: OpenVpnConfig }): React.JSX.Element {
  const { t } = useTranslation()
  const needs = [
    config.requiresUserPass ? t('vpn.wizard.needsUserPass') : null,
    config.requiresKeyPassphrase ? t('vpn.wizard.needsKey') : null,
    config.redirectGateway ? t('vpn.wizard.fullTunnel') : null
  ].filter(Boolean)
  return (
    <div
      className="rounded-md border border-border bg-surface-elevated/40 p-3 text-xs"
      data-testid="ovpn-summary"
    >
      {config.remoteSummary.map((r) => (
        <p key={`${r.host}:${r.port}:${r.proto}`} className="font-mono text-foreground">
          {t('vpn.wizard.server', { host: r.host, port: r.port, proto: r.proto.toUpperCase() })}
        </p>
      ))}
      <p className="mt-1 text-muted">
        {needs.length ? needs.join(' · ') : t('vpn.wizard.noSecrets')}
      </p>
    </div>
  )
}
