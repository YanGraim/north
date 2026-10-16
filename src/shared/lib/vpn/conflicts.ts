import type { VpnConflict, VpnKind } from '@shared/types'
import { cidrsOverlap, parseCidr } from './cidr'

export type VpnConflictCandidate = {
  profileId: string
  kind: VpnKind
  /** Declared (pre-connect) or pushed (post-connect) routes. */
  routes: string[]
  fullTunnel: boolean
}

/**
 * Conflicts between a VPN about to connect and those already active. Pure —
 * the caller decides whether to ask the user ("disconnect X" / "connect anyway").
 */
export function detectConflicts(
  candidate: VpnConflictCandidate,
  active: VpnConflictCandidate[],
  platform: string
): VpnConflict[] {
  const conflicts: VpnConflict[] = []
  for (const other of active) {
    if (other.profileId === candidate.profileId) continue

    if (candidate.fullTunnel || other.fullTunnel) {
      conflicts.push({ type: 'full-tunnel', withProfileId: other.profileId })
      continue
    }

    if (platform === 'darwin' && candidate.kind === 'ipsec-ikev1' && other.kind === 'ipsec-ikev1') {
      conflicts.push({ type: 'platform-single-ipsec', withProfileId: other.profileId })
      continue
    }

    const overlap = findOverlap(candidate.routes, other.routes)
    if (overlap) {
      conflicts.push({
        type: 'overlapping-routes',
        withProfileId: other.profileId,
        detail: `${overlap[0]} ↔ ${overlap[1]}`
      })
    }
  }
  return conflicts
}

function findOverlap(a: string[], b: string[]): [string, string] | null {
  for (const x of a) {
    const cx = parseCidr(x)
    if (!cx) continue
    for (const y of b) {
      const cy = parseCidr(y)
      if (cy && cidrsOverlap(cx, cy)) return [x, y]
    }
  }
  return null
}
