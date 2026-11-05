import type { AppLocale } from '@shared/ipc'
import type { VpnStatus } from '@shared/types'

export type VpnNoticeReason = 'connected' | 'disconnect-requested' | 'dropped'

export type VpnNoticeKind = 'connected' | 'disconnected' | 'dropped'

export type VpnNoticeEvent = {
  profileId: string
  from: VpnStatus
  to: VpnStatus
  reason: VpnNoticeReason
}

const COPY: Record<AppLocale, Record<VpnNoticeKind, { title: string; body: string }>> = {
  'pt-BR': {
    connected: { title: 'VPN conectada', body: '{name} está no ar.' },
    disconnected: { title: 'VPN desconectada', body: '{name} foi desligada.' },
    dropped: { title: 'VPN caiu', body: '{name} perdeu a conexão.' }
  },
  en: {
    connected: { title: 'VPN connected', body: '{name} is up.' },
    disconnected: { title: 'VPN disconnected', body: '{name} was turned off.' },
    dropped: { title: 'VPN dropped', body: '{name} lost the connection.' }
  },
  es: {
    connected: { title: 'VPN conectada', body: '{name} está en línea.' },
    disconnected: { title: 'VPN desconectada', body: '{name} se apagó.' },
    dropped: { title: 'VPN caída', body: '{name} perdió la conexión.' }
  }
}

/**
 * One notice per real transition. Repeating `reconnecting`, a first-try `error`,
 * a disabled preference, or quitting all stay silent.
 */
export function vpnNoticeFor(input: {
  from: VpnStatus
  to: VpnStatus
  reason: VpnNoticeReason
  enabled: boolean
  quitting: boolean
}): VpnNoticeKind | null {
  if (!input.enabled || input.quitting || input.from === input.to) return null
  if (input.reason === 'connected' && input.to === 'connected') return 'connected'
  if (input.reason === 'disconnect-requested' && input.to === 'disconnected') return 'disconnected'
  if (input.reason === 'dropped' && (input.to === 'reconnecting' || input.to === 'disconnected')) {
    return 'dropped'
  }
  return null
}

export function vpnNoticeCopy(
  kind: VpnNoticeKind,
  name: string,
  locale: AppLocale
): { title: string; body: string } {
  const copy = COPY[locale][kind]
  return { title: copy.title, body: copy.body.replace('{name}', () => name) }
}
