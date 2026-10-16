import { cn } from '@renderer/lib/utils'
import type { VpnTone } from '@renderer/lib/vpn-ui'
import type { VpnState, VpnStatus } from '@shared/types'
import { useTranslation } from 'react-i18next'

export function toneOf(status: VpnStatus | undefined): VpnTone {
  switch (status) {
    case 'connected':
      return 'connected'
    case 'connecting':
    case 'reconnecting':
    case 'disconnecting':
      return 'connecting'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

export function VpnDot({
  tone,
  className
}: {
  tone: VpnTone
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        tone === 'connected' && 'bg-emerald-500',
        tone === 'connecting' && 'bg-amber-500 motion-safe:animate-pulse',
        tone === 'error' && 'bg-destructive',
        tone === 'idle' && 'bg-muted/60',
        className
      )}
    />
  )
}

/** Dot + text — color is never the only signal. */
export function VpnStatusLabel({ state }: { state: VpnState | undefined }): React.JSX.Element {
  const { t } = useTranslation()
  const status = state?.status ?? 'disconnected'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" data-testid="vpn-status">
      <VpnDot tone={toneOf(status)} />
      {t(`vpn.status.${status}`, { attempt: state?.reconnectAttempt ?? 1 })}
    </span>
  )
}
