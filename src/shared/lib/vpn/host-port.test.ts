import { describe, expect, it } from 'vitest'
import { normalizeFortinetConfig, splitHostPort } from './host-port'

describe('splitHostPort', () => {
  it.each([
    ['179.190.99.2:4433', { host: '179.190.99.2', port: 4433 }],
    [' vpn.acme.com:10443 ', { host: 'vpn.acme.com', port: 10443 }],
    ['vpn.acme.com', { host: 'vpn.acme.com' }],
    ['https://vpn.acme.com:8443/', { host: 'vpn.acme.com', port: 8443 }],
    ['[fd00::1]:443', { host: 'fd00::1', port: 443 }],
    ['fd00::1', { host: 'fd00::1' }],
    ['host:99999', { host: 'host:99999' }]
  ])('%s', (input, expected) => {
    expect(splitHostPort(input)).toEqual(expected)
  })
})

describe('normalizeFortinetConfig', () => {
  it('moves a port typed into the gateway to the port field', () => {
    expect(
      normalizeFortinetConfig({
        kind: 'fortinet-sslvpn',
        gateway: '179.190.99.2:4433',
        port: 443,
        username: 'u'
      })
    ).toEqual({ kind: 'fortinet-sslvpn', gateway: '179.190.99.2', port: 4433, username: 'u' })
  })

  it('leaves other kinds and clean configs untouched', () => {
    const ipsec = {
      kind: 'ipsec-ikev1' as const,
      gateway: 'g:1',
      username: 'u',
      xauth: 'saved' as const
    }
    expect(normalizeFortinetConfig(ipsec)).toBe(ipsec)
    const clean = { kind: 'fortinet-sslvpn' as const, gateway: 'g', port: 443, username: 'u' }
    expect(normalizeFortinetConfig(clean)).toEqual(clean)
  })
})
