import type { VpnConfig, VpnState } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  mergeVpnState,
  requiredSecretFields,
  summarizeVpns,
  vpnErrorAction,
  vpnErrorFromUnknown
} from './vpn-ui'

const state = (over: Partial<VpnState>): VpnState => ({
  profileId: 'a',
  status: 'disconnected',
  since: '2026-10-16T00:00:00.000Z',
  leases: 0,
  trigger: null,
  version: 1,
  ...over
})

describe('summarizeVpns', () => {
  const names = new Map([
    ['a', 'POLY'],
    ['b', 'ACME']
  ])
  it('idle when nothing is up', () => {
    expect(summarizeVpns([state({})], names)).toEqual({ tone: 'idle', count: 0, label: null })
  })
  it('one connected shows its name', () => {
    expect(summarizeVpns([state({ status: 'connected' })], names)).toEqual({
      tone: 'connected',
      count: 1,
      label: 'POLY'
    })
  })
  it('several connected shows a count', () => {
    const s = summarizeVpns(
      [state({ status: 'connected' }), state({ profileId: 'b', status: 'connected' })],
      names
    )
    expect(s).toMatchObject({ tone: 'connected', count: 2, label: null })
  })
  it('error wins over connecting wins over connected', () => {
    const connecting = summarizeVpns(
      [state({ status: 'connected' }), state({ profileId: 'b', status: 'reconnecting' })],
      names
    )
    expect(connecting.tone).toBe('connecting')
    const error = summarizeVpns(
      [state({ status: 'connecting' }), state({ profileId: 'b', status: 'error' })],
      names
    )
    expect(error.tone).toBe('error')
  })
})

describe('mergeVpnState', () => {
  it('replaces by profile and drops out-of-order events', () => {
    let list = [state({ version: 5 })]
    list = mergeVpnState(list, state({ status: 'connecting', version: 4 }))
    expect(list[0].status).toBe('disconnected')
    list = mergeVpnState(list, state({ status: 'connected', version: 6 }))
    expect(list[0].status).toBe('connected')
    list = mergeVpnState(list, state({ profileId: 'b', version: 1 }))
    expect(list).toHaveLength(2)
  })
})

describe('vpnErrorAction', () => {
  it.each([
    ['AUTH_FAILED', 'update-secret'],
    ['KEY_PASSPHRASE_WRONG', 'update-secret'],
    ['SECRET_MISSING', 'update-secret'],
    ['BINARY_MISSING', 'install'],
    ['PRIVILEGE_DENIED', 'retry'],
    ['TIMEOUT', 'retry'],
    ['UNSUPPORTED_ON_PLATFORM', null]
  ] as const)('%s → %s', (code, action) => {
    expect(vpnErrorAction(code)).toBe(action)
  })
})

describe('vpnErrorFromUnknown', () => {
  it('parses the [VPN:CODE] wire format out of an Electron invoke error', () => {
    const error = new Error(
      "Error invoking remote method 'vpn:connect': Error: [VPN:AUTH_FAILED] Senha recusada"
    )
    expect(vpnErrorFromUnknown(error)).toEqual({ code: 'AUTH_FAILED', message: 'Senha recusada' })
    expect(vpnErrorFromUnknown(new Error('x'))).toBeNull()
  })
})

describe('requiredSecretFields', () => {
  const base = {
    kind: 'openvpn' as const,
    ovpn: 'x',
    remoteSummary: [],
    redirectGateway: false,
    declaredRoutes: []
  }
  it('openvpn asks only what the file needs', () => {
    expect(
      requiredSecretFields({ ...base, requiresUserPass: true, requiresKeyPassphrase: false })
    ).toEqual(['username', 'password'])
    expect(
      requiredSecretFields({ ...base, requiresUserPass: false, requiresKeyPassphrase: true })
    ).toEqual(['key-passphrase'])
  })
  it('fortinet ssl-vpn asks username and password', () => {
    expect(
      requiredSecretFields({ kind: 'fortinet-sslvpn', gateway: 'g', port: 4433, username: 'u' })
    ).toEqual(['username', 'password'])
    expect(vpnErrorAction('CERT_UNTRUSTED')).toBe('trust-cert')
  })

  it('ipsec', () => {
    const ikev1: VpnConfig = { kind: 'ipsec-ikev1', gateway: 'g', username: 'u', xauth: 'saved' }
    expect(requiredSecretFields(ikev1)).toEqual(['psk', 'password'])
    expect(requiredSecretFields({ ...ikev1, xauth: 'prompt' })).toEqual(['psk'])
    expect(
      requiredSecretFields({ kind: 'ipsec-ikev2', gateway: 'g', username: 'u', auth: 'eap' })
    ).toEqual(['password'])
    expect(
      requiredSecretFields({ kind: 'ipsec-ikev2', gateway: 'g', username: 'u', auth: 'psk' })
    ).toEqual(['psk'])
  })
})
