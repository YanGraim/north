import { detectConflicts } from '@shared/lib/vpn/conflicts'
import { formatVpnErrorMessage } from '@shared/lib/vpn/errors'
import { parseOvpn } from '@shared/lib/vpn/ovpn-parse'
import type {
  CreateVpnProfileInput,
  ImportOvpnInput,
  SetVpnSecretInput,
  UpdateVpnProfileInput,
  VpnConnectInput,
  VpnErrorCode,
  VpnHistoryEntry,
  VpnProfile,
  VpnSecretKind,
  VpnState
} from '@shared/types'

type Listener = (state: VpnState) => void

/** Scriptable `window.north.vpn` for Cypress — `window.__vpnMock` drives failures and drops. */
export function createVpnMock() {
  const profiles: VpnProfile[] = []
  const states = new Map<string, VpnState>()
  const secrets = new Map<string, Set<VpnSecretKind>>()
  const logs = new Map<string, string[]>()
  const history: VpnHistoryEntry[] = []
  const listeners = new Set<Listener>()
  let version = 0
  let nextFailure: VpnErrorCode | null = null
  const connectDelayMs = 250

  const now = () => new Date().toISOString()
  const setState = (profileId: string, patch: Partial<VpnState>): VpnState => {
    version += 1
    const prev = states.get(profileId) ?? {
      profileId,
      status: 'disconnected' as const,
      since: now(),
      leases: 0,
      trigger: null,
      version
    }
    const next: VpnState = { ...prev, ...patch, version, since: patch.status ? now() : prev.since }
    if (next.status !== 'error') delete next.lastError
    states.set(profileId, next)
    for (const l of listeners) l(next)
    return next
  }
  const stateOf = (id: string) => states.get(id) ?? setState(id, {})
  const log = (id: string, line: string) =>
    logs.set(id, [...(logs.get(id) ?? []), `${now()} ${line}`])
  const secretStatus = (id: string) => {
    const set = secrets.get(id) ?? new Set()
    return Object.fromEntries(
      (['password', 'key-passphrase', 'psk', 'private-key', 'ovpn-inline'] as const).map((k) => [
        k,
        set.has(k)
      ])
    ) as Record<VpnSecretKind, boolean>
  }
  const candidate = (p: VpnProfile) => ({
    profileId: p.id,
    kind: p.kind,
    routes: p.config.kind === 'openvpn' ? p.config.declaredRoutes : [],
    fullTunnel: p.config.kind === 'openvpn' && p.config.redirectGateway
  })
  const conflictsFor = (id: string) => {
    const p = profiles.find((x) => x.id === id)
    if (!p) return []
    const active = profiles.filter((x) => x.id !== id && stateOf(x.id).status === 'connected')
    return detectConflicts(candidate(p), active.map(candidate), 'darwin')
  }
  const create = (input: CreateVpnProfileInput): VpnProfile => {
    const profile: VpnProfile = {
      id: crypto.randomUUID(),
      clientId: input.clientId ?? null,
      name: input.name,
      kind: input.config.kind,
      config: input.config,
      autoDisconnect: input.autoDisconnect ?? 'when-idle',
      idleTimeoutSec: input.idleTimeoutSec ?? 300,
      notes: input.notes ?? null,
      createdAt: now(),
      updatedAt: now()
    }
    profiles.push(profile)
    setState(profile.id, {})
    return profile
  }

  const api = {
    // fresh objects like real IPC results — in-place mutation would hide changes from TanStack Query
    list: async () => profiles.map((p) => structuredClone(p)),
    get: async (id: string) => {
      const p = profiles.find((x) => x.id === id)
      return p ? structuredClone(p) : null
    },
    create: async (input: CreateVpnProfileInput) => create(input),
    update: async (id: string, input: UpdateVpnProfileInput) => {
      const p = profiles.find((x) => x.id === id)
      if (!p) throw new Error('VPN não encontrada')
      Object.assign(p, input, input.config ? { kind: input.config.kind } : {}, { updatedAt: now() })
      return { ...p }
    },
    delete: async (id: string) => {
      const i = profiles.findIndex((p) => p.id === id)
      if (i >= 0) profiles.splice(i, 1)
      states.delete(id)
    },
    importOvpn: async (input: ImportOvpnInput) => {
      try {
        const parsed = parseOvpn(input.content)
        if (input.profileId) {
          const existing = profiles.find((p) => p.id === input.profileId)
          if (!existing) throw new Error('VPN não encontrada')
          Object.assign(existing, { config: parsed.config, kind: 'openvpn', updatedAt: now() })
          return { profile: { ...existing }, inlineBlocks: Object.keys(parsed.inlineBlocks) }
        }
        const profile = create({
          name: input.name ?? parsed.suggestedName,
          clientId: input.clientId,
          config: parsed.config
        })
        const blocks = Object.keys(parsed.inlineBlocks)
        if (blocks.length) secrets.set(profile.id, new Set(['ovpn-inline']))
        return { profile, inlineBlocks: blocks }
      } catch (error) {
        throw new Error(formatVpnErrorMessage('INVALID_CONFIG', (error as Error).message))
      }
    },
    setSecret: async (input: SetVpnSecretInput) => {
      const set = secrets.get(input.profileId) ?? new Set()
      if (input.secret) set.add(input.kind)
      else set.delete(input.kind)
      secrets.set(input.profileId, set)
      return secretStatus(input.profileId)
    },
    secretStatus: async (id: string) => secretStatus(id),
    connect: async (input: VpnConnectInput) => {
      const id = input.profileId
      if (!input.force && conflictsFor(id).length) {
        throw new Error(formatVpnErrorMessage('CONFLICT', 'conflito'))
      }
      setState(id, { status: 'connecting', trigger: 'manual', leases: 1 })
      log(id, 'connecting')
      await new Promise((r) => setTimeout(r, connectDelayMs))
      const target = profiles.find((p) => p.id === id)
      if (target?.config.kind === 'fortinet-sslvpn' && !target.config.trustedCert) {
        const certDigest = 'c'.repeat(64)
        setState(id, {
          status: 'error',
          leases: 0,
          trigger: null,
          lastError: { code: 'CERT_UNTRUSTED', message: 'certificado não reconhecido', certDigest }
        })
        throw new Error(formatVpnErrorMessage('CERT_UNTRUSTED', 'certificado não reconhecido'))
      }
      const failure = nextFailure
      nextFailure = null
      const entry: VpnHistoryEntry = {
        id: crypto.randomUUID(),
        vpnProfileId: id,
        startedAt: now(),
        endedAt: now(),
        trigger: 'manual',
        result: failure ? 'error' : 'connected',
        errorCode: failure
      }
      history.unshift(entry)
      if (failure) {
        log(id, `ERRO ${failure}`)
        setState(id, {
          status: 'error',
          leases: 0,
          trigger: null,
          lastError: { code: failure, message: failure }
        })
        throw new Error(formatVpnErrorMessage(failure, failure))
      }
      log(id, 'STATE CONNECTED SUCCESS')
      return setState(id, { status: 'connected', localIp: '10.8.0.6', routes: ['10.20.0.0/16'] })
    },
    disconnect: async (id: string) => {
      log(id, 'disconnect')
      return setState(id, {
        status: 'disconnected',
        leases: 0,
        trigger: null,
        localIp: undefined,
        routes: undefined
      })
    },
    status: async () => profiles.map((p) => stateOf(p.id)),
    logs: async (id: string) => logs.get(id) ?? [],
    history: async (id: string) => history.filter((h) => h.vpnProfileId === id),
    checkConflicts: async (id: string) => conflictsFor(id),
    platformSupport: async () => ({
      openvpn: { ok: true as const },
      'ipsec-ikev1': { ok: false as const, reason: 'em breve' },
      'ipsec-ikev2': { ok: false as const, reason: 'em breve' },
      'fortinet-sslvpn': { ok: true as const }
    }),
    helperStatus: async () => 'installed' as const,
    installHelper: async () => 'installed' as const,
    uninstallHelper: async () => 'missing' as const,
    onStateChanged: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }

  const control = {
    failNext: (code: VpnErrorCode) => {
      nextFailure = code
    },
    drop: (id: string) =>
      setState(id, { status: 'error', lastError: { code: 'DRIVER_CRASHED', message: 'drop' } }),
    seed: (input: CreateVpnProfileInput, connected = false) => {
      const p = create(input)
      if (connected)
        setState(p.id, { status: 'connected', localIp: '10.9.0.2', trigger: 'manual', leases: 1 })
      return p.id
    }
  }
  ;(window as unknown as { __vpnMock: typeof control }).__vpnMock = control
  return api
}
