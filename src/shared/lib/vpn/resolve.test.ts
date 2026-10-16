import { describe, expect, it } from 'vitest'
import { resolveVpn } from './resolve'

describe('resolveVpn', () => {
  const env = { vpnProfileId: 'env-vpn' }
  const client = { vpnProfileId: 'client-vpn' }

  it.each([
    [
      'inherit → environment wins over client',
      { vpnMode: 'inherit' as const, vpnProfileId: null },
      env,
      client,
      'env-vpn'
    ],
    [
      'inherit → falls back to client',
      { vpnMode: 'inherit' as const, vpnProfileId: null },
      { vpnProfileId: null },
      client,
      'client-vpn'
    ],
    [
      'inherit → nothing linked',
      { vpnMode: 'inherit' as const, vpnProfileId: null },
      { vpnProfileId: null },
      { vpnProfileId: null },
      null
    ],
    [
      'none ignores inheritance',
      { vpnMode: 'none' as const, vpnProfileId: 'x' },
      env,
      client,
      null
    ],
    ['explicit profile', { vpnMode: 'profile' as const, vpnProfileId: 'own' }, env, client, 'own'],
    [
      'explicit profile without id → null',
      { vpnMode: 'profile' as const, vpnProfileId: null },
      env,
      client,
      null
    ],
    [
      'inherit ignores a stale own id',
      { vpnMode: 'inherit' as const, vpnProfileId: 'stale' },
      env,
      client,
      'env-vpn'
    ]
  ])('%s', (_label, target, e, c, expected) => {
    expect(resolveVpn(target, e, c)).toBe(expected)
  })

  it('tolerates missing env/client (access resolved via group chain)', () => {
    expect(resolveVpn({ vpnMode: 'inherit', vpnProfileId: null }, null, client)).toBe('client-vpn')
    expect(resolveVpn({ vpnMode: 'inherit', vpnProfileId: null }, undefined, undefined)).toBeNull()
  })
})
