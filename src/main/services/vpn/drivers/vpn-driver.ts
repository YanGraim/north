import type { VpnKind, VpnProfile, VpnSecretKind } from '@shared/types'

export type SupportResult = { ok: true } | { ok: false; reason: string }

/** Lazy, main-only access to a profile's secrets. */
export type SecretResolver = {
  get(kind: VpnSecretKind): string | null
  inlineBlocks(): Record<string, string>
}

export type VpnTunnelInfo = {
  localIp?: string
  routes: string[]
  redirectGateway: boolean
}

export type VpnConnectContext = {
  profile: VpnProfile
  secrets: SecretResolver
  log: (line: string) => void
  /** Optional user-facing progress hint, surfaced as `VpnState.detail`. */
  progress?: (detail: string) => void
  signal: AbortSignal
}

/**
 * One driver instance per connection attempt — it owns that tunnel's process/state.
 * Drivers know nothing about leases or UI; they throw `VpnError` with a code.
 */
export interface VpnDriver {
  connect(ctx: VpnConnectContext): Promise<VpnTunnelInfo>
  disconnect(): Promise<void>
  /** Fired once when an established tunnel goes away without `disconnect()`. */
  onDrop(cb: (error?: Error) => void): void
}

export type VpnDriverFactory = {
  kind: VpnKind
  isSupported(platform: NodeJS.Platform): SupportResult
  create(): VpnDriver
}

/** Registry of drivers by kind — the only place that maps kind → implementation. */
export class VpnDriverRegistry {
  private readonly factories = new Map<VpnKind, VpnDriverFactory>()

  register(factory: VpnDriverFactory): void {
    this.factories.set(factory.kind, factory)
  }

  get(kind: VpnKind): VpnDriverFactory | null {
    return this.factories.get(kind) ?? null
  }

  support(platform: NodeJS.Platform): Record<VpnKind, SupportResult> {
    const kinds: VpnKind[] = ['openvpn', 'ipsec-ikev1', 'ipsec-ikev2', 'fortinet-sslvpn']
    return Object.fromEntries(
      kinds.map((kind) => [
        kind,
        this.factories.get(kind)?.isSupported(platform) ?? {
          ok: false,
          reason: 'Ainda não suportado nesta versão'
        }
      ])
    ) as Record<VpnKind, SupportResult>
  }
}
