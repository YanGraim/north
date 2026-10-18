import type { Connection, VpnState } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { VpnError } from './vpn-error'
import { VpnGate, VpnGateError } from './vpn-gate'

const ENV = 'e0000000-0000-4000-8000-000000000000'
const GROUP = 'a0000000-0000-4000-8000-000000000000'
const POLY = 'b0000000-0000-4000-8000-000000000000'
const OTHER = 'c0000000-0000-4000-8000-000000000000'

function setup(opts: {
  connection?: Partial<Connection>
  envLink?: string | null
  clientLink?: string | null
  connected?: boolean
  fail?: Error
  reachableAfter?: number
}) {
  const calls: string[] = []
  let probes = 0
  const gate = new VpnGate({
    repos: {
      connections: {
        get: () => ({ groupId: GROUP, vpnMode: 'inherit', vpnProfileId: null, ...opts.connection })
      },
      accesses: { get: () => null },
      groups: { get: () => ({ environmentId: ENV }) },
      vpnProfiles: {
        get: (id: string) => ({ name: id === POLY ? 'POLY' : 'OTHER' }),
        linkForEnvironment: () => ({
          environment: opts.envLink ?? null,
          client: opts.clientLink ?? null
        })
      }
    } as never,
    manager: {
      getState: () => ({ status: opts.connected ? 'connected' : 'disconnected' }) as VpnState,
      acquire: async (profileId: string, holder: string) => {
        calls.push(`acquire ${profileId === POLY ? 'POLY' : 'OTHER'} ${holder}`)
        if (opts.fail) throw opts.fail
        return {} as VpnState
      },
      release: (holder: string) => {
        calls.push(`release ${holder}`)
      }
    },
    probe: async () => ++probes > (opts.reachableAfter ?? 0),
    probeDelayMs: 1
  })
  return { gate, calls, probes: () => probes }
}

describe('VpnGate', () => {
  it('inherits the Environment VPN, then the Client one', () => {
    expect(setup({ envLink: POLY, clientLink: OTHER }).gate.profileForConnection('x')).toBe(POLY)
    expect(setup({ clientLink: OTHER }).gate.profileForConnection('x')).toBe(OTHER)
    expect(setup({}).gate.profileForConnection('x')).toBeNull()
  })

  it('vpnMode none ignores inheritance; profile picks its own', () => {
    expect(
      setup({ envLink: POLY, connection: { vpnMode: 'none' } }).gate.profileForConnection('x')
    ).toBeNull()
    expect(
      setup({
        envLink: POLY,
        connection: { vpnMode: 'profile', vpnProfileId: OTHER }
      }).gate.profileForConnection('x')
    ).toBe(OTHER)
  })

  it('no VPN → no lease', async () => {
    const { gate, calls } = setup({})
    await gate.ensure(null, 's1')
    expect(calls).toEqual([])
  })

  it('takes a lease per session and releases it', async () => {
    const { gate, calls } = setup({})
    await gate.ensure(POLY, 's1', { host: '172.16.0.10', port: 22 })
    gate.release('s1')
    expect(calls).toEqual(['acquire POLY s1', 'release s1'])
  })

  it('waits until the target answers on a tunnel that just came up', async () => {
    const { gate, probes } = setup({ reachableAfter: 2 })
    await gate.ensure(POLY, 's1', { host: '172.16.0.10', port: 22 })
    expect(probes()).toBe(3)
  })

  it('an already connected tunnel does not delay the session with probes', async () => {
    const { gate, probes } = setup({ connected: true })
    await gate.ensure(POLY, 's1', { host: '172.16.0.10', port: 22 })
    expect(probes()).toBe(0)
  })

  it('VPN failure becomes a session error naming the VPN, lease released', async () => {
    const { gate, calls } = setup({
      fail: new VpnError('AUTH_FAILED', 'Chave pré-compartilhada incorreta')
    })
    const err = await gate.ensure(POLY, 's1').catch((e) => e)
    expect(err).toBeInstanceOf(VpnGateError)
    expect(err.message).toBe('VPN POLY: Chave pré-compartilhada incorreta')
    expect(err.code).toBe('AUTH_FAILED')
    expect(calls).toEqual(['acquire POLY s1', 'release s1'])
  })
})
