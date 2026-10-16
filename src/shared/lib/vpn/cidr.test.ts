import { describe, expect, it } from 'vitest'
import { cidrsOverlap, parseCidr } from './cidr'

describe('parseCidr', () => {
  it('parses IPv4 and IPv6 with and without prefix', () => {
    expect(parseCidr('10.0.0.0/8')).toMatchObject({ family: 4, prefix: 8 })
    expect(parseCidr('10.1.2.3')).toMatchObject({ family: 4, prefix: 32 })
    expect(parseCidr('fd00::/8')).toMatchObject({ family: 6, prefix: 8 })
    expect(parseCidr('::1')).toMatchObject({ family: 6, prefix: 128 })
  })

  it('accepts openvpn "network netmask" notation', () => {
    expect(parseCidr('192.168.10.0 255.255.255.0')).toMatchObject({ family: 4, prefix: 24 })
  })

  it('rejects garbage', () => {
    expect(parseCidr('300.1.1.1/8')).toBeNull()
    expect(parseCidr('10.0.0.0/33')).toBeNull()
    expect(parseCidr('vpn.example.com')).toBeNull()
    expect(parseCidr('1.2.3.4 255.0.255.0')).toBeNull()
    expect(parseCidr('1:::2')).toBeNull()
  })
})

describe('cidrsOverlap', () => {
  it.each([
    ['10.0.0.0/8', '10.20.0.0/16', true],
    ['192.168.1.0/24', '192.168.2.0/24', false],
    ['192.168.1.0/24', '192.168.1.255/32', true],
    ['192.168.1.0/25', '192.168.1.128/25', false],
    ['0.0.0.0/0', '172.16.0.0/12', true],
    ['10.0.0.1/32', '10.0.0.1/32', true],
    ['fd00::/8', 'fd12:3456::/32', true],
    ['fd00::/16', 'fe80::/10', false],
    ['10.0.0.0/8', 'fd00::/8', false]
  ])('%s vs %s → %s', (a, b, expected) => {
    expect(cidrsOverlap(a, b)).toBe(expected)
  })
})
