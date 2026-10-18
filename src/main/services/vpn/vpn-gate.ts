import { connect as tcpConnect } from 'node:net'
import { resolveVpn, type VpnTarget } from '@shared/lib/vpn/resolve'
import type { Repositories } from '../../repositories'
import { VpnError } from './vpn-error'
import type { VpnManager } from './vpn-manager'

export type VpnGateDeps = {
  repos: Pick<Repositories, 'connections' | 'accesses' | 'groups' | 'vpnProfiles'>
  manager: Pick<VpnManager, 'acquire' | 'release' | 'getState'>
  /** TCP reachability once the tunnel is up (routes can take a moment). */
  probe?: (host: string, port: number, timeoutMs: number) => Promise<boolean>
  probeAttempts?: number
  probeDelayMs?: number
}

/** Session error that names the VPN, so the UI can point at it. */
export class VpnGateError extends Error {
  readonly cause = 'vpn'
  constructor(
    message: string,
    readonly profileId: string,
    readonly code?: string
  ) {
    super(message)
    this.name = 'VpnGateError'
  }
}

export function tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = tcpConnect({ host, port })
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Brings a session's VPN up before ProtocolManager opens it: resolves the profile
 * (Connection/Access → Environment → Client), takes one lease per session (shared
 * tunnel, auto-disconnect when the last one goes) and waits until the target answers.
 */
export class VpnGate {
  constructor(private readonly deps: VpnGateDeps) {}

  profileForConnection(connectionId: string): string | null {
    const connection = this.deps.repos.connections.get(connectionId)
    return connection ? this.resolve(connection, connection.groupId) : null
  }

  profileForAccess(accessId: string): string | null {
    const access = this.deps.repos.accesses.get(accessId)
    return access ? this.resolve(access, access.groupId) : null
  }

  /**
   * No-op without a VPN. Throws VpnGateError (lease released) when the tunnel can't
   * come up. The probe is best effort: a closed port is the session's problem, not the VPN's.
   */
  async ensure(
    profileId: string | null,
    holderId: string,
    target?: { host: string; port: number }
  ): Promise<void> {
    if (!profileId) return
    const name = this.deps.repos.vpnProfiles.get(profileId)?.name ?? 'VPN'
    // probe only a tunnel that is coming up now; an established one doesn't delay sessions
    const fresh = this.deps.manager.getState(profileId).status !== 'connected'
    try {
      await this.deps.manager.acquire(profileId, holderId)
    } catch (error) {
      this.deps.manager.release(holderId)
      const message = error instanceof Error ? error.message : String(error)
      const code = error instanceof VpnError ? error.code : undefined
      throw new VpnGateError(`VPN ${name}: ${message}`, profileId, code)
    }
    if (target && fresh) await this.waitReachable(target)
  }

  release(holderId: string): void {
    this.deps.manager.release(holderId)
  }

  private resolve(target: VpnTarget, groupId: string): string | null {
    const group = this.deps.repos.groups.get(groupId)
    const links = group
      ? this.deps.repos.vpnProfiles.linkForEnvironment(group.environmentId)
      : { environment: null, client: null }
    return resolveVpn(target, { vpnProfileId: links.environment }, { vpnProfileId: links.client })
  }

  private async waitReachable(target: { host: string; port: number }): Promise<void> {
    const probe = this.deps.probe ?? tcpProbe
    const attempts = this.deps.probeAttempts ?? 3
    for (let i = 0; i < attempts; i++) {
      if (await probe(target.host, target.port, 1500)) return
      if (i < attempts - 1) await sleep(this.deps.probeDelayMs ?? 500)
    }
  }
}
