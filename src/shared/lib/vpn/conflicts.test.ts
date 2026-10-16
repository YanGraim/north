import { describe, expect, it } from 'vitest'
import { detectConflicts, type VpnConflictCandidate } from './conflicts'

const vpn = (over: Partial<VpnConflictCandidate>): VpnConflictCandidate => ({
  profileId: 'x',
  kind: 'openvpn',
  routes: [],
  fullTunnel: false,
  ...over
})

describe('detectConflicts', () => {
  it('returns nothing for disjoint networks', () => {
    const a = vpn({ profileId: 'a', routes: ['10.1.0.0/16'] })
    const b = vpn({ profileId: 'b', routes: ['10.2.0.0/16'] })
    expect(detectConflicts(a, [b], 'darwin')).toEqual([])
  })

  it('flags overlapping routes with the offending pair', () => {
    const a = vpn({ profileId: 'a', routes: ['192.168.1.0/24'] })
    const b = vpn({ profileId: 'b', routes: ['10.0.0.0/8', '192.168.0.0/16'] })
    expect(detectConflicts(a, [b], 'linux')).toEqual([
      { type: 'overlapping-routes', withProfileId: 'b', detail: '192.168.1.0/24 ↔ 192.168.0.0/16' }
    ])
  })

  it('flags full-tunnel on either side, once', () => {
    const a = vpn({ profileId: 'a', fullTunnel: true, routes: ['10.0.0.0/8'] })
    const b = vpn({ profileId: 'b', routes: ['10.0.0.0/8'] })
    const types = detectConflicts(a, [b], 'linux').map((c) => c.type)
    expect(types).toEqual(['full-tunnel'])
    expect(detectConflicts(b, [a], 'linux').map((c) => c.type)).toEqual(['full-tunnel'])
  })

  it('only one IKEv1 at a time on macOS', () => {
    const a = vpn({ profileId: 'a', kind: 'ipsec-ikev1' })
    const b = vpn({ profileId: 'b', kind: 'ipsec-ikev1' })
    expect(detectConflicts(a, [b], 'darwin').map((c) => c.type)).toEqual(['platform-single-ipsec'])
    expect(detectConflicts(a, [b], 'linux')).toEqual([])
  })

  it('ignores the candidate itself in the active list', () => {
    const a = vpn({ profileId: 'a', fullTunnel: true })
    expect(detectConflicts(a, [a], 'darwin')).toEqual([])
  })
})
