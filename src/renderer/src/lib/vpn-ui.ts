import { parseVpnErrorMessage } from '@shared/lib/vpn/errors'
import type { VpnConfig, VpnErrorCode, VpnSecretKind, VpnState } from '@shared/types'

export type VpnTone = 'idle' | 'connected' | 'connecting' | 'error'

/** Titlebar pill: worst state wins (error > connecting > connected > idle). */
export function summarizeVpns(
  states: VpnState[],
  names: Map<string, string>
): { tone: VpnTone; count: number; label: string | null } {
  const connected = states.filter((s) => s.status === 'connected')
  let tone: VpnTone = 'idle'
  if (connected.length > 0) tone = 'connected'
  if (states.some((s) => ['connecting', 'reconnecting', 'disconnecting'].includes(s.status))) {
    tone = 'connecting'
  }
  if (states.some((s) => s.status === 'error')) tone = 'error'
  const label = connected.length === 1 ? (names.get(connected[0].profileId) ?? null) : null
  return { tone, count: connected.length, label }
}

/** Apply a `vpn:state-changed` event, ignoring anything older than what we hold. */
export function mergeVpnState(states: VpnState[], next: VpnState): VpnState[] {
  const current = states.find((s) => s.profileId === next.profileId)
  if (current && current.version > next.version) return states
  return current
    ? states.map((s) => (s.profileId === next.profileId ? next : s))
    : [...states, next]
}

export type VpnErrorAction = 'update-secret' | 'install' | 'retry' | null

export function vpnErrorAction(code: VpnErrorCode): VpnErrorAction {
  switch (code) {
    case 'AUTH_FAILED':
    case 'KEY_PASSPHRASE_WRONG':
    case 'SECRET_MISSING':
    case 'CONNECTION_REJECTED':
      return 'update-secret'
    case 'BINARY_MISSING':
      return 'install'
    case 'PRIVILEGE_DENIED':
    case 'TIMEOUT':
    case 'HOST_UNREACHABLE':
    case 'DRIVER_CRASHED':
      return 'retry'
    default:
      return null
  }
}

export function vpnErrorFromUnknown(
  error: unknown
): { code: VpnErrorCode; message: string } | null {
  return error instanceof Error ? parseVpnErrorMessage(error.message) : null
}

export type VpnSecretField = VpnSecretKind | 'username'

/** Only the fields this profile actually needs, in FortiClient-like order. */
export function requiredSecretFields(config: VpnConfig): VpnSecretField[] {
  switch (config.kind) {
    case 'openvpn':
      return [
        ...(config.requiresUserPass ? (['username', 'password'] as const) : []),
        ...(config.requiresKeyPassphrase ? (['key-passphrase'] as const) : [])
      ]
    case 'ipsec-ikev1':
      return config.xauth === 'saved' ? ['psk', 'password'] : ['psk']
    case 'ipsec-ikev2':
      return config.auth === 'psk' ? ['psk'] : ['password']
  }
}
