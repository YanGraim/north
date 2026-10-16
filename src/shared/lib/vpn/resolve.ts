import type { VpnMode } from '@shared/types'

export type VpnTarget = { vpnMode: VpnMode; vpnProfileId: string | null }
type VpnLink = { vpnProfileId: string | null } | null | undefined

/**
 * Which VPN profile a Connection/Access needs. `inherit` takes the Environment's
 * profile, then the Client's; Accesses reach env/client through their Group.
 */
export function resolveVpn(
  target: VpnTarget,
  environment: VpnLink,
  client: VpnLink
): string | null {
  if (target.vpnMode === 'none') return null
  if (target.vpnMode === 'profile') return target.vpnProfileId ?? null
  return environment?.vpnProfileId ?? client?.vpnProfileId ?? null
}
