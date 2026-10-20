import { detectConflicts, type VpnConflictCandidate } from '@shared/lib/vpn/conflicts'
import { createRedactor } from '@shared/lib/vpn/redact'
import type {
  VpnConflict,
  VpnErrorCode,
  VpnHistoryEntry,
  VpnProfile,
  VpnState,
  VpnStatus,
  VpnTrigger
} from '@shared/types'
import type {
  SecretResolver,
  VpnDriver,
  VpnDriverRegistry,
  VpnTunnelInfo
} from './drivers/vpn-driver'
import { toVpnError, VpnError } from './vpn-error'

const MANUAL_HOLDER = 'manual'
const DEFAULT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16_000]
const LOG_LIMIT = 2000
/** Errors where retrying just hammers the server with the same bad input. */
const NON_RETRYABLE: VpnErrorCode[] = [
  'AUTH_FAILED',
  'KEY_PASSPHRASE_WRONG',
  'SECRET_MISSING',
  'BINARY_MISSING',
  'PRIVILEGE_DENIED',
  'UNSUPPORTED_ON_PLATFORM',
  'INVALID_CONFIG',
  'CERT_UNTRUSTED',
  'PROFILE_APPROVAL_REQUIRED',
  'CONNECTION_REJECTED'
]

export type VpnManagerDeps = {
  profiles: { get(id: string): VpnProfile | null }
  /** Main-only secret access; `values()` feeds the log redactor. */
  secrets: (profileId: string) => SecretResolver & { values(): string[] }
  drivers: VpnDriverRegistry
  history?: {
    start(profileId: string, trigger: VpnTrigger): string
    finish(id: string, result: VpnHistoryEntry['result'], errorCode?: VpnErrorCode | null): void
  }
  platform: NodeJS.Platform
  emit: (state: VpnState) => void
  backoffMs?: number[]
}

type Entry = {
  profileId: string
  status: VpnStatus
  since: Date
  trigger: VpnTrigger | null
  leases: Set<string>
  info?: VpnTunnelInfo
  lastError?: { code: VpnErrorCode; message: string; certDigest?: string }
  driver?: VpnDriver
  connecting?: Promise<VpnState>
  abort?: AbortController
  idleTimer?: NodeJS.Timeout
  reconnectTimer?: NodeJS.Timeout
  reconnectAttempt: number
  logs: string[]
  detail?: string
  redact: (line: string) => string
}

/**
 * Single source of truth for VPN tunnels: one state machine per profile,
 * leases per holder (session id or "manual"), shared connect promise,
 * idle auto-disconnect for auto-started tunnels, reconnect with backoff.
 */
export class VpnManager {
  private readonly entries = new Map<string, Entry>()
  private version = 0
  private suspendedIds: string[] = []

  constructor(private readonly deps: VpnManagerDeps) {}

  getState(profileId: string): VpnState {
    return this.toState(this.entry(profileId))
  }

  listStates(): VpnState[] {
    return [...this.entries.values()].map((e) => this.toState(e))
  }

  logs(profileId: string): string[] {
    return [...(this.entries.get(profileId)?.logs ?? [])]
  }

  appendLog(profileId: string, line: string): void {
    const entry = this.entry(profileId)
    entry.logs.push(`${new Date().toISOString()} ${entry.redact(line)}`)
    if (entry.logs.length > LOG_LIMIT) entry.logs.splice(0, entry.logs.length - LOG_LIMIT)
  }

  /** "Ligar" from the UI: a manual lease that only "Desligar" removes. */
  async connect(profileId: string, opts: { force?: boolean } = {}): Promise<VpnState> {
    const entry = this.entry(profileId)
    entry.trigger = 'manual'
    return this.hold(entry, MANUAL_HOLDER, 'manual', opts.force)
  }

  /** Used by VpnGate: one lease per session. */
  async acquire(
    profileId: string,
    holderId: string,
    opts: { force?: boolean } = {}
  ): Promise<VpnState> {
    return this.hold(this.entry(profileId), holderId, 'auto', opts.force)
  }

  release(holderId: string): void {
    for (const entry of this.entries.values()) {
      if (!entry.leases.delete(holderId)) continue
      this.emit(entry)
      this.maybeScheduleIdle(entry)
    }
  }

  async disconnect(profileId: string): Promise<void> {
    const entry = this.entries.get(profileId)
    if (!entry) return
    entry.leases.clear()
    this.clearTimers(entry)
    entry.reconnectAttempt = 0
    entry.abort?.abort()
    if (entry.connecting) await entry.connecting.catch(() => {})
    const driver = entry.driver
    entry.driver = undefined
    if (driver) {
      this.setStatus(entry, 'disconnecting')
      await driver.disconnect().catch(() => {})
    }
    entry.info = undefined
    entry.trigger = null
    this.setStatus(entry, 'disconnected')
  }

  checkConflicts(profileId: string): VpnConflict[] {
    const profile = this.requireProfile(profileId)
    const active = [...this.entries.values()]
      .filter(
        (e) =>
          e.profileId !== profileId &&
          (e.status === 'connected' || e.status === 'connecting' || e.status === 'reconnecting')
      )
      .map((e) => this.candidate(e.profileId, e.info))
      .filter((c): c is VpnConflictCandidate => c !== null)
    return detectConflicts(
      this.candidate(profile.id) as VpnConflictCandidate,
      active,
      this.deps.platform
    )
  }

  suspend(): void {
    this.suspendedIds = [...this.entries.values()]
      .filter((e) => e.status === 'connected' || e.status === 'reconnecting')
      .map((e) => e.profileId)
  }

  /** After sleep the tunnel is usually dead but the process may not know yet — restart it. */
  async resume(): Promise<void> {
    const ids = this.suspendedIds
    this.suspendedIds = []
    await Promise.all(
      ids.map(async (id) => {
        const entry = this.entries.get(id)
        if (!entry || entry.leases.size === 0) return
        this.clearTimers(entry)
        const driver = entry.driver
        entry.driver = undefined
        await driver?.disconnect().catch(() => {})
        entry.reconnectAttempt = 0
        await this.startConnect(entry, false).catch(() => {})
      })
    )
  }

  async shutdown(timeoutMs = 5000): Promise<void> {
    const all = Promise.all([...this.entries.keys()].map((id) => this.disconnect(id)))
    await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))])
  }

  private async hold(
    entry: Entry,
    holderId: string,
    trigger: VpnTrigger,
    force?: boolean
  ): Promise<VpnState> {
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer)
      entry.idleTimer = undefined
    }
    const isNew = !entry.leases.has(holderId)
    entry.leases.add(holderId)
    try {
      if (entry.status === 'connected') {
        this.emit(entry)
        return this.toState(entry)
      }
      if (entry.connecting) return await entry.connecting
      if (!force) {
        const conflicts = this.checkConflicts(entry.profileId)
        if (conflicts.length > 0) {
          throw new VpnError('CONFLICT', 'Esta VPN conflita com outra já ativa', conflicts)
        }
      }
      if (trigger === 'auto' && entry.trigger !== 'manual') entry.trigger = 'auto'
      return await this.startConnect(entry, true)
    } catch (error) {
      if (isNew) entry.leases.delete(holderId)
      if (holderId === MANUAL_HOLDER && entry.leases.size === 0) entry.trigger = null
      this.emit(entry)
      throw error
    }
  }

  private startConnect(entry: Entry, fresh: boolean): Promise<VpnState> {
    if (fresh) entry.reconnectAttempt = 0
    const promise = this.runConnect(entry).finally(() => {
      if (entry.connecting === promise) entry.connecting = undefined
    })
    entry.connecting = promise
    return promise
  }

  private async runConnect(entry: Entry): Promise<VpnState> {
    const profile = this.requireProfile(entry.profileId)
    if (entry.reconnectAttempt === 0) this.setStatus(entry, 'connecting')
    const historyId = this.deps.history?.start(profile.id, entry.trigger ?? 'auto')
    const abort = new AbortController()
    entry.abort = abort

    try {
      // imported from another North: the user is personal and never travels in the file
      if ('username' in profile.config && profile.kind !== 'openvpn' && !profile.config.username) {
        throw new VpnError(
          'INVALID_CONFIG',
          `Informe seu usuário na VPN "${profile.name}" (Editar) antes de conectar`
        )
      }
      const factory = this.deps.drivers.get(profile.kind)
      const support = factory?.isSupported(this.deps.platform)
      if (!factory || !support?.ok) {
        throw new VpnError(
          'UNSUPPORTED_ON_PLATFORM',
          support && !support.ok ? support.reason : 'Este tipo de VPN ainda não é suportado'
        )
      }
      const secrets = this.deps.secrets(profile.id)
      entry.redact = createRedactor(secrets.values())
      const driver = factory.create()
      driver.onDrop((error) => this.handleDrop(entry, driver, error))
      entry.driver = driver
      const info = await driver.connect({
        profile,
        secrets,
        log: (line) => this.appendLog(profile.id, line),
        progress: (detail) => {
          entry.detail = detail
          this.appendLog(profile.id, detail)
          this.emit(entry)
        },
        signal: abort.signal
      })
      if (abort.signal.aborted) {
        await driver.disconnect().catch(() => {})
        throw new VpnError('TIMEOUT', 'Conexão cancelada')
      }
      entry.info = info
      entry.lastError = undefined
      entry.reconnectAttempt = 0
      if (historyId) this.deps.history?.finish(historyId, 'connected', null)
      this.setStatus(entry, 'connected')
      this.maybeScheduleIdle(entry)
      return this.toState(entry)
    } catch (error) {
      const vpnError = toVpnError(error)
      entry.driver = undefined
      if (historyId) {
        this.deps.history?.finish(
          historyId,
          abort.signal.aborted ? 'cancelled' : 'error',
          vpnError.code
        )
      }
      this.appendLog(entry.profileId, `ERRO ${vpnError.code}: ${vpnError.message}`)
      if (abort.signal.aborted) throw vpnError
      entry.lastError = {
        code: vpnError.code,
        message: vpnError.message,
        ...(vpnError.certDigest ? { certDigest: vpnError.certDigest } : {})
      }
      if (entry.reconnectAttempt > 0 && !NON_RETRYABLE.includes(vpnError.code)) {
        this.scheduleReconnect(entry)
      } else {
        entry.leases.clear()
        this.setStatus(entry, 'error')
      }
      throw vpnError
    } finally {
      if (entry.abort === abort) entry.abort = undefined
    }
  }

  private handleDrop(entry: Entry, driver: VpnDriver, error?: Error): void {
    if (entry.driver !== driver) return
    entry.driver = undefined
    entry.info = undefined
    this.appendLog(entry.profileId, `Túnel caiu: ${error?.message ?? 'sem detalhes'}`)
    if (entry.leases.size === 0) {
      entry.trigger = null
      this.setStatus(entry, 'disconnected')
      return
    }
    this.scheduleReconnect(entry)
  }

  private scheduleReconnect(entry: Entry): void {
    const backoff = this.deps.backoffMs ?? DEFAULT_BACKOFF_MS
    if (entry.reconnectAttempt >= backoff.length) {
      entry.reconnectAttempt = 0
      this.setStatus(entry, 'error')
      return
    }
    const delay = backoff[entry.reconnectAttempt]
    entry.reconnectAttempt += 1
    this.setStatus(entry, 'reconnecting')
    entry.reconnectTimer = setTimeout(() => {
      entry.reconnectTimer = undefined
      this.startConnect(entry, false).catch(() => {})
    }, delay)
  }

  private maybeScheduleIdle(entry: Entry): void {
    if (entry.leases.size > 0 || entry.status !== 'connected' || entry.trigger !== 'auto') return
    const profile = this.deps.profiles.get(entry.profileId)
    if (profile?.autoDisconnect !== 'when-idle') return
    if (entry.idleTimer) clearTimeout(entry.idleTimer)
    entry.idleTimer = setTimeout(() => {
      entry.idleTimer = undefined
      if (entry.leases.size === 0) void this.disconnect(entry.profileId)
    }, profile.idleTimeoutSec * 1000)
  }

  private clearTimers(entry: Entry): void {
    if (entry.idleTimer) clearTimeout(entry.idleTimer)
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer)
    entry.idleTimer = undefined
    entry.reconnectTimer = undefined
  }

  private candidate(profileId: string, info?: VpnTunnelInfo): VpnConflictCandidate | null {
    const profile = this.deps.profiles.get(profileId)
    if (!profile) return null
    const declared = profile.config.kind === 'openvpn' ? profile.config.declaredRoutes : []
    const declaredFull = profile.config.kind === 'openvpn' && profile.config.redirectGateway
    return {
      profileId,
      kind: profile.kind,
      routes: [...new Set([...declared, ...(info?.routes ?? [])])],
      fullTunnel: declaredFull || Boolean(info?.redirectGateway)
    }
  }

  private requireProfile(id: string): VpnProfile {
    const profile = this.deps.profiles.get(id)
    if (!profile) throw new VpnError('INVALID_CONFIG', 'VPN não encontrada')
    return profile
  }

  private entry(profileId: string): Entry {
    let entry = this.entries.get(profileId)
    if (!entry) {
      this.requireProfile(profileId)
      entry = {
        profileId,
        status: 'disconnected',
        since: new Date(),
        trigger: null,
        leases: new Set(),
        reconnectAttempt: 0,
        logs: [],
        redact: createRedactor([])
      }
      this.entries.set(profileId, entry)
    }
    return entry
  }

  private setStatus(entry: Entry, status: VpnStatus): void {
    if (status !== 'connecting' && status !== 'reconnecting') entry.detail = undefined
    if (entry.status !== status) entry.since = new Date()
    entry.status = status
    this.emit(entry)
  }

  private emit(entry: Entry): void {
    this.deps.emit(this.toState(entry))
  }

  private toState(entry: Entry): VpnState {
    this.version += 1
    return {
      profileId: entry.profileId,
      status: entry.status,
      since: entry.since.toISOString(),
      ...(entry.info?.localIp ? { localIp: entry.info.localIp } : {}),
      ...(entry.info
        ? {
            routes: entry.info.redirectGateway
              ? ['0.0.0.0/0', ...entry.info.routes.filter((r) => r !== '0.0.0.0/0')]
              : entry.info.routes
          }
        : {}),
      ...(entry.lastError && entry.status === 'error' ? { lastError: entry.lastError } : {}),
      ...(entry.lastError && entry.status === 'reconnecting' ? { lastError: entry.lastError } : {}),
      leases: entry.leases.size,
      trigger: entry.trigger,
      ...(entry.reconnectAttempt > 0 ? { reconnectAttempt: entry.reconnectAttempt } : {}),
      ...(entry.detail ? { detail: entry.detail } : {}),
      version: this.version
    }
  }
}
