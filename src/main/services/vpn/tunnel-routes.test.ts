import { describe, expect, it } from 'vitest'
import {
  maskToPrefix,
  normalizeCidr,
  parseIpRoutes,
  parseNetstatRoutes,
  parseWindowsRoutes
} from './tunnel-routes'

// trimmed from the real PAC SSL-VPN (openfortivpn on macOS)
const NETSTAT = `Routing tables

Internet:
Destination        Gateway            Flags               Netif Expire
default            192.168.1.1        UGScg                 en0
default            link#28            UCSIg                ppp0
10.10.100/24       ppp0               USc                  ppp0
169.254.2.1        10.10.100.50       UH                   ppp0
172.16.40/24       ppp0               USc                  ppp0
172.16.59.50/32    ppp0               USc                  ppp0
172.16.136/21      ppp0               USc                  ppp0
192.168.1          link#11            UCS                   en0      !
224.0.0/4          link#28            UmCSI                ppp0
255.255.255.255/32 link#28            UCSI                 ppp0
`

describe('tunnel routes', () => {
  it('normalizes netstat short networks', () => {
    expect(normalizeCidr('172.16.40/24')).toBe('172.16.40.0/24')
    expect(normalizeCidr('10/8')).toBe('10.0.0.0/8')
    expect(normalizeCidr('169.254.2.1')).toBeNull()
  })

  it('macOS: only the tunnel interface, without scoped default, multicast or broadcast', () => {
    expect(parseNetstatRoutes(NETSTAT, 'ppp0')).toEqual([
      '10.10.100.0/24',
      '172.16.40.0/24',
      '172.16.59.50/32',
      '172.16.136.0/21'
    ])
  })

  it('Linux: ip route show dev', () => {
    expect(
      parseIpRoutes(
        'default scope link\n10.10.100.0/24 proto kernel scope link src 10.10.100.50\n172.16.40.0/24 scope link\n'
      )
    ).toEqual(['10.10.100.0/24', '172.16.40.0/24'])
  })

  it('Windows: route print -4, only routes through the tunnel address', () => {
    const out = `IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0      192.168.1.1    192.168.1.20     25
      10.10.100.0    255.255.255.0         On-link     10.10.100.50    257
     10.10.100.50  255.255.255.255         On-link     10.10.100.50    257
      172.16.40.0    255.255.255.0         On-link     10.10.100.50      1
     172.16.136.0    255.255.248.0         On-link     10.10.100.50      1
        224.0.0.0        240.0.0.0         On-link     10.10.100.50    257
===========================================================================
Persistent Routes:
  None`
    expect(parseWindowsRoutes(out, '10.10.100.50')).toEqual([
      '10.10.100.0/24',
      '172.16.40.0/24',
      '172.16.136.0/21'
    ])
    expect(maskToPrefix('255.255.240.0')).toBe(20)
    expect(maskToPrefix('255.0.255.0')).toBeNull()
  })
})
