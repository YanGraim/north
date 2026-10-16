import type { VpnErrorCode, VpnKind } from '@shared/types'
import { VpnError } from '../vpn-error'
import type { VpnConnectContext, VpnDriver, VpnDriverFactory, VpnTunnelInfo } from './vpn-driver'

export type FakeVpnBehavior = {
  connectDelayMs?: number
  failWith?: VpnErrorCode
  info?: Partial<VpnTunnelInfo>
}

export class FakeVpnDriver implements VpnDriver {
  connected = false
  private dropCallbacks: Array<(error?: Error) => void> = []

  constructor(private readonly behavior: () => FakeVpnBehavior) {}

  async connect(ctx: VpnConnectContext): Promise<VpnTunnelInfo> {
    const b = this.behavior()
    ctx.log(`fake: connecting ${ctx.profile.name}`)
    if (b.connectDelayMs) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, b.connectDelayMs)
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(t)
          reject(new VpnError('TIMEOUT', 'Conexão cancelada'))
        })
      })
    }
    if (b.failWith) throw new VpnError(b.failWith, `fake ${b.failWith}`)
    this.connected = true
    ctx.log('fake: connected')
    return { routes: [], redirectGateway: false, localIp: '10.99.0.2', ...b.info }
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  onDrop(cb: (error?: Error) => void): void {
    this.dropCallbacks.push(cb)
  }

  /** Test hook: simulate the tunnel going away. */
  drop(): void {
    this.connected = false
    const cbs = this.dropCallbacks
    this.dropCallbacks = []
    for (const cb of cbs) cb(new VpnError('DRIVER_CRASHED', 'fake drop'))
  }
}

/** Registered for every kind under NORTH_VPN_FAKE=1 and in unit tests. */
export function createFakeVpnDriverFactory(
  kind: VpnKind,
  behavior: () => FakeVpnBehavior = () => ({})
) {
  const instances: FakeVpnDriver[] = []
  const factory: VpnDriverFactory & { instances: FakeVpnDriver[] } = {
    kind,
    instances,
    isSupported: () => ({ ok: true }),
    create: () => {
      const driver = new FakeVpnDriver(behavior)
      instances.push(driver)
      return driver
    }
  }
  return factory
}
