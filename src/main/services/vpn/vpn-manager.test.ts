import type { VpnConfig, VpnProfile, VpnState } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVpnDriverFactory, type FakeVpnBehavior } from './drivers/fake-vpn-driver'
import { VpnDriverRegistry } from './drivers/vpn-driver'
import { VpnManager } from './vpn-manager'

const ovpn = (routes: string[] = [], redirectGateway = false): VpnConfig => ({
  kind: 'openvpn',
  ovpn: 'client',
  requiresUserPass: false,
  requiresKeyPassphrase: false,
  remoteSummary: [{ host: 'h', port: 1194, proto: 'udp' }],
  redirectGateway,
  declaredRoutes: routes
})

function makeProfile(id: string, over: Partial<VpnProfile> = {}): VpnProfile {
  return {
    id,
    clientId: null,
    name: id.toUpperCase(),
    kind: 'openvpn',
    config: ovpn(),
    autoDisconnect: 'when-idle',
    idleTimeoutSec: 60,
    notes: null,
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
    ...over
  }
}

function setup(profiles: VpnProfile[], behavior: FakeVpnBehavior = {}) {
  let current = behavior
  const factory = createFakeVpnDriverFactory('openvpn', () => current)
  const drivers = new VpnDriverRegistry()
  drivers.register(factory)
  const events: VpnState[] = []
  const history = { start: vi.fn(() => 'h1'), finish: vi.fn() }
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const manager = new VpnManager({
    profiles: { get: (id) => byId.get(id) ?? null },
    secrets: () => ({
      get: () => 'super-secret',
      inlineBlocks: () => ({}),
      values: () => ['super-secret']
    }),
    drivers,
    history,
    platform: 'darwin',
    emit: (s) => events.push(s)
  })
  return {
    manager,
    factory,
    events,
    history,
    setBehavior: (b: FakeVpnBehavior) => {
      current = b
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('VpnManager', () => {
  it('manual connect: disconnected → connecting → connected, emits monotonic versions', async () => {
    const { manager, events, history } = setup([makeProfile('a')])
    const state = await manager.connect('a')
    expect(state).toMatchObject({
      status: 'connected',
      trigger: 'manual',
      leases: 1,
      localIp: '10.99.0.2'
    })
    expect(events.map((e) => e.status)).toEqual(['connecting', 'connected'])
    expect(events[1].version).toBeGreaterThan(events[0].version)
    expect(history.start).toHaveBeenCalledWith('a', 'manual')
    expect(history.finish).toHaveBeenCalledWith('h1', 'connected', null)
  })

  it('concurrent acquires share one connect (one driver instance)', async () => {
    const { manager, factory } = setup([makeProfile('a')], { connectDelayMs: 100 })
    const p1 = manager.acquire('a', 's1')
    const p2 = manager.acquire('a', 's2')
    await vi.advanceTimersByTimeAsync(100)
    const [s1, s2] = await Promise.all([p1, p2])
    expect(factory.instances).toHaveLength(1)
    expect(s1.status).toBe('connected')
    expect(s2.leases).toBe(2)
    expect(s2.trigger).toBe('auto')
  })

  it('auto VPN disconnects after idle timeout once leases hit zero; reacquire cancels it', async () => {
    const { manager } = setup([makeProfile('a', { idleTimeoutSec: 60 })])
    await manager.acquire('a', 's1')
    manager.release('s1')
    await vi.advanceTimersByTimeAsync(30_000)
    await manager.acquire('a', 's2')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(manager.getState('a').status).toBe('connected')

    manager.release('s2')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(manager.getState('a').status).toBe('disconnected')
  })

  it('autoDisconnect=never keeps an auto VPN up', async () => {
    const { manager } = setup([makeProfile('a', { autoDisconnect: 'never' })])
    await manager.acquire('a', 's1')
    manager.release('s1')
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(manager.getState('a').status).toBe('connected')
  })

  it('manually connected VPN never drops on its own even after sessions release', async () => {
    const { manager } = setup([makeProfile('a')])
    await manager.connect('a')
    await manager.acquire('a', 's1')
    manager.release('s1')
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(manager.getState('a')).toMatchObject({ status: 'connected', leases: 1 })
  })

  it('an auto VPN later switched on manually becomes manual', async () => {
    const { manager } = setup([makeProfile('a')])
    await manager.acquire('a', 's1')
    await manager.connect('a')
    manager.release('s1')
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(manager.getState('a')).toMatchObject({ status: 'connected', trigger: 'manual' })
  })

  it('disconnect clears leases and stops the driver', async () => {
    const { manager, factory } = setup([makeProfile('a')])
    await manager.connect('a')
    await manager.acquire('a', 's1')
    await manager.disconnect('a')
    expect(manager.getState('a')).toMatchObject({ status: 'disconnected', leases: 0 })
    expect(factory.instances[0].connected).toBe(false)
  })

  it('connect failure → error state with code; the failing holder is released', async () => {
    const { manager, history } = setup([makeProfile('a')], { failWith: 'AUTH_FAILED' })
    await expect(manager.acquire('a', 's1')).rejects.toMatchObject({ code: 'AUTH_FAILED' })
    expect(manager.getState('a')).toMatchObject({
      status: 'error',
      leases: 0,
      lastError: { code: 'AUTH_FAILED' }
    })
    expect(history.finish).toHaveBeenCalledWith('h1', 'error', 'AUTH_FAILED')
  })

  it('drop with active leases → reconnecting with backoff, then connected', async () => {
    const { manager, factory, events } = setup([makeProfile('a')])
    await manager.acquire('a', 's1')
    factory.instances[0].drop()
    expect(manager.getState('a')).toMatchObject({ status: 'reconnecting', reconnectAttempt: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(manager.getState('a').status).toBe('connected')
    expect(factory.instances).toHaveLength(2)
    expect(events.some((e) => e.status === 'reconnecting')).toBe(true)
  })

  it('gives up after 5 attempts (1-2-4-8-16s) → error', async () => {
    const { manager, factory, setBehavior } = setup([makeProfile('a')])
    await manager.acquire('a', 's1')
    setBehavior({ failWith: 'HOST_UNREACHABLE' })
    factory.instances[0].drop()
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000)
    expect(manager.getState('a')).toMatchObject({ status: 'reconnecting', reconnectAttempt: 5 })
    await vi.advanceTimersByTimeAsync(16_000)
    expect(manager.getState('a')).toMatchObject({
      status: 'error',
      lastError: { code: 'HOST_UNREACHABLE' }
    })
  })

  it('does not retry on AUTH_FAILED during reconnect', async () => {
    const { manager, factory, setBehavior } = setup([makeProfile('a')])
    await manager.acquire('a', 's1')
    setBehavior({ failWith: 'AUTH_FAILED' })
    factory.instances[0].drop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(manager.getState('a')).toMatchObject({
      status: 'error',
      lastError: { code: 'AUTH_FAILED' }
    })
    expect(factory.instances).toHaveLength(2)
  })

  it('drop with no leases → disconnected, no reconnect', async () => {
    const { manager, factory } = setup([makeProfile('a', { autoDisconnect: 'never' })])
    await manager.acquire('a', 's1')
    manager.release('s1')
    factory.instances[0].drop()
    expect(manager.getState('a').status).toBe('disconnected')
  })

  it('conflicts block connect unless forced', async () => {
    const { manager } = setup([
      makeProfile('a', { config: ovpn(['192.168.1.0/24']) }),
      makeProfile('b', { config: ovpn(['192.168.0.0/16']) })
    ])
    await manager.connect('a')
    expect(manager.checkConflicts('b')).toEqual([
      expect.objectContaining({ type: 'overlapping-routes', withProfileId: 'a' })
    ])
    await expect(manager.connect('b')).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(manager.getState('b')).toMatchObject({ status: 'disconnected', leases: 0 })
    await expect(manager.connect('b', { force: true })).resolves.toMatchObject({
      status: 'connected'
    })
  })

  it('uses pushed routes of the active tunnel for conflict checks', async () => {
    const { manager } = setup(
      [makeProfile('a'), makeProfile('b', { config: ovpn(['10.20.5.0/24']) })],
      { info: { routes: ['10.20.0.0/16'] } }
    )
    await manager.connect('a')
    expect(manager.checkConflicts('b')).toHaveLength(1)
  })

  it('two VPNs without conflict stay up together', async () => {
    const { manager } = setup([
      makeProfile('a', { config: ovpn(['10.1.0.0/16']) }),
      makeProfile('b', { config: ovpn(['10.2.0.0/16']) })
    ])
    await manager.connect('a')
    await manager.connect('b')
    expect(manager.listStates().filter((s) => s.status === 'connected')).toHaveLength(2)
  })

  it('unknown profile and unsupported kind', async () => {
    const { manager } = setup([
      makeProfile('x', {
        kind: 'ipsec-ikev1',
        config: { kind: 'ipsec-ikev1', gateway: 'g', username: 'u', xauth: 'saved' }
      })
    ])
    await expect(manager.connect('nope')).rejects.toThrow()
    await expect(manager.connect('x')).rejects.toMatchObject({ code: 'UNSUPPORTED_ON_PLATFORM' })
  })

  it('disconnect during connecting cancels it', async () => {
    const { manager } = setup([makeProfile('a')], { connectDelayMs: 10_000 })
    const pending = manager.connect('a').catch((e) => e)
    await vi.advanceTimersByTimeAsync(10)
    await manager.disconnect('a')
    expect(await pending).toMatchObject({ code: 'TIMEOUT' })
    expect(manager.getState('a').status).toBe('disconnected')
  })

  it('logs are redacted and capped', async () => {
    const { manager } = setup([makeProfile('a')])
    await manager.connect('a')
    manager.appendLog('a', 'got super-secret from server')
    for (let i = 0; i < 2100; i++) manager.appendLog('a', `line ${i}`)
    const logs = manager.logs('a')
    expect(logs).toHaveLength(2000)
    expect(logs.join('\n')).not.toContain('super-secret')
    expect(logs.at(-1)).toContain('line 2099')
  })

  it('resume reconnects tunnels that were up before suspend', async () => {
    const { manager, factory } = setup([makeProfile('a')])
    await manager.connect('a')
    manager.suspend()
    await manager.resume()
    expect(factory.instances).toHaveLength(2)
    expect(factory.instances[0].connected).toBe(false)
    expect(manager.getState('a').status).toBe('connected')
  })

  it('shutdown disconnects everything', async () => {
    const { manager, factory } = setup([makeProfile('a'), makeProfile('b')])
    await manager.connect('a')
    await manager.acquire('b', 's')
    await manager.shutdown()
    expect(factory.instances.every((d) => !d.connected)).toBe(true)
  })
})
