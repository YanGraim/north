import { randomUUID } from 'node:crypto'
import type { ListDirectoryResult } from '@shared/lib/list-directory'
import { normalizeLogFilePath } from '@shared/lib/log-file'
import {
  type ClassifyPathResult,
  ClassifyPathResultSchema,
  isSafePosixAbsolute
} from '@shared/lib/selection-path'
import { canonicalPosixDir } from '@shared/lib/startup-directory'
import {
  type ClaudeUsage,
  coerceBytes,
  type HostKeyPrompt,
  type HostKeyResponse,
  isSqlStudioEngine,
  type ProtocolDriver,
  type ProtocolSession,
  type SessionDescriptor,
  type SessionPortMessage,
  type SessionState,
  type TerminalShellCapability
} from '@shared/protocols'
import type { Access, Connection } from '@shared/types'
import type { MessagePortMain, WebContents } from 'electron'
import { MessageChannelMain } from 'electron'
import {
  cwdForPid,
  findActiveClaudeSessionFile,
  findClaudeDescendantPid,
  readLatestClaudeUsage
} from '../lib/claude-usage'
import { ApiProtocolSession } from '../protocols/api/session'
import { configFromAccess } from '../protocols/database/config'
import { connectAdapter } from '../protocols/database/registry'
import { DatabaseProtocolSession } from '../protocols/database/session'
import { LocalShellDriver } from '../protocols/local-shell-driver'
import { prepareSessionDirectoryList } from '../protocols/ssh-directory-list'
import { fingerprintHostKey, parseHostKeyType } from '../protocols/ssh-utils'
import type { Repositories } from '../repositories'
import { disposeRemoteEdits } from '../services/file-transfer/remote-edit-service'
import { releaseSessionTransfers } from '../services/file-transfer/session-transfer'
import type { CredentialVault } from '../vault'

type ActiveSession = {
  session: ProtocolSession
  descriptor: SessionDescriptor
  connectionId: string | null
  accessId: string | null
  startedAt: number
  portMain: MessagePortMain | null
  historyRecorded: boolean
  everConnected: boolean
  /** Where the connection came from (organizations only). */
  source?: ConnectionSource
}

export type ProtocolManagerEvents = {
  onStateChanged: (descriptor: SessionDescriptor) => void
  onHostKeyPrompt: (prompt: HostKeyPrompt) => void
  /** Bridged terminal stream (also mirrors MessagePort outbound). */
  onSessionMessage?: (sessionId: string, message: SessionPortMessage) => void
}

export type MessageChannelFactory = () => { port1: MessagePortMain; port2: MessagePortMain }

/** What ProtocolManager needs from VpnGate (kept structural so tests can stub it). */
export type VpnGateLike = {
  profileForConnection(connectionId: string): string | null
  profileForAccess(accessId: string): string | null
  ensure(
    profileId: string | null,
    holderId: string,
    target?: { host: string; port: number }
  ): Promise<void>
  release(holderId: string): void
}

/**
 * Where `open()` finds a Connection and its password. Defaults to the local
 * inventory + vault; an organization swaps in the North Server (ADR 0018 §8),
 * which fetches each password just in time.
 */
export type ConnectionSource = {
  connection(connectionId: string): Promise<Connection | null>
  resolveSecret(credentialRef: string): Promise<string>
  vpnProfile(connectionId: string): string | null | Promise<string | null>
  /** Organization accesses (REC-023); the personal workspace reads SQLite. */
  access?(accessId: string): Promise<Access | null>
  accessVpnProfile?(accessId: string): Promise<string | null>
  /** Workspace the source belongs to, so its sessions can be rechecked or ended together. */
  scope?: string
}

export class ProtocolManager {
  private readonly drivers = new Map<string, ProtocolDriver>()
  private readonly sessions = new Map<string, ActiveSession>()
  private readonly pendingHostKeys = new Map<
    string,
    {
      resolve: (accept: boolean) => void
      host: string
      port: number
      keyType: string
      fingerprint: string
      hostKey: Buffer
    }
  >()
  private readonly stdoutReady = new Set<string>()
  private readonly stdoutBuffer = new Map<string, SessionPortMessage[]>()

  private events: ProtocolManagerEvents | null = null
  private vpnGate: VpnGateLike | null = null
  private connectionSource: (() => ConnectionSource | null) | null = null
  private readonly createChannel: MessageChannelFactory
  private readonly localShellDriver = new LocalShellDriver()

  constructor(
    private readonly repositories: Repositories,
    private readonly vault: CredentialVault,
    createChannel: MessageChannelFactory = () => new MessageChannelMain()
  ) {
    this.createChannel = createChannel
  }

  setEvents(events: ProtocolManagerEvents): void {
    this.events = events
  }

  /** VPN before sessions (ADR 0017): resolved per Connection/Access, one lease per session. */
  setVpnGate(gate: VpnGateLike | null): void {
    this.vpnGate = gate
  }

  /** Asked on every open (follows the active workspace); null = the local inventory and vault. */
  setConnectionSource(provider: (() => ConnectionSource | null) | null): void {
    this.connectionSource = provider
  }

  /**
   * Connection and secret resolver for a log follow. Not a session: no history row.
   * Uses the active workspace source, same as `open`.
   */
  async openFollowTarget(connectionId: string): Promise<{
    connection: Connection
    resolveSecret: (credentialRef: string) => Promise<string>
  } | null> {
    const source = this.sourceForOpen()
    const connection = await source.connection(connectionId)
    if (!connection) return null
    return {
      connection,
      resolveSecret: (credentialRef) => source.resolveSecret(credentialRef)
    }
  }

  /** Same VPN lease as a session, without registering one. */
  async prepareFollowVpn(connection: Connection, followId: string): Promise<void> {
    const probeTarget = connection.jumpHostId
      ? undefined
      : { host: connection.host, port: connection.port }
    const profile = await this.sourceForOpen().vpnProfile(connection.id)
    await this.vpnGate?.ensure(profile, followId, probeTarget)
  }

  releaseFollowVpn(followId: string): void {
    this.vpnGate?.release(followId)
  }

  /** Host-key prompt shared with sessions. `followId` is only a label on the prompt. */
  confirmHostKey(
    followId: string,
    info: {
      host: string
      port: number
      keyType: string
      fingerprint: string
      hostKey: Uint8Array
    }
  ): Promise<boolean> {
    return this.verifyHostKey(followId, info, 'log-follow')
  }

  private sourceForOpen(): ConnectionSource {
    return (
      this.connectionSource?.() ?? {
        connection: async (id) => this.repositories.connections.get(id),
        resolveSecret: async (ref) => this.vault.resolveSecret(ref),
        vpnProfile: (id) => this.vpnGate?.profileForConnection(id) ?? null
      }
    )
  }

  /** Kept for callers that track the focused window; unused internally for now. */
  setSender(_sender: WebContents | null): void {
    // no-op — events go through setEvents callbacks registered by IPC layer
  }

  register(driver: ProtocolDriver): void {
    for (const protocol of driver.protocols) {
      this.drivers.set(protocol, driver)
    }
  }

  list(): SessionDescriptor[] {
    return [...this.sessions.values()].map((s) => ({ ...s.descriptor }))
  }

  get(sessionId: string): SessionDescriptor | undefined {
    const active = this.sessions.get(sessionId)
    return active ? { ...active.descriptor } : undefined
  }

  getActiveSession(sessionId: string): ProtocolSession | undefined {
    return this.sessions.get(sessionId)?.session
  }

  /**
   * Stat a path on the SSH client that already owns the terminal.
   * Other protocols, a missing session, or an invalid path never open SFTP.
   * Failures become `unavailable`. ssh2 messages are not returned.
   */
  /**
   * One directory on the SSH client that already owns this terminal.
   * Other sessions and unsafe paths never open SFTP. ssh2 messages are not returned.
   * A listing failure does not change the terminal session.
   */
  async listDirectory(sessionId: string, path: string): Promise<ListDirectoryResult> {
    const active = this.sessions.get(sessionId)
    const session = active?.session
    const prepared = prepareSessionDirectoryList({
      path,
      protocol: session?.protocol ?? null,
      connectionId: active?.connectionId ?? null,
      canList: session?.listDirectory != null
    })
    if (!prepared.ok) return prepared
    if (!session?.listDirectory) return { ok: false, reason: 'unavailable' }
    try {
      return await session.listDirectory.list(prepared.path)
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
  }

  /**
   * File actions on the SSH terminal that already owns this session.
   * Other protocols and sessions without a saved connection are refused.
   */
  shellCapability(sessionId: string): TerminalShellCapability | null {
    const active = this.sessions.get(sessionId)
    if (!active?.connectionId || active.session.protocol !== 'ssh') return null
    return active.session.terminalShell ?? null
  }

  async classifyPath(sessionId: string, path: string): Promise<ClassifyPathResult> {
    const normalized = normalizeLogFilePath(path)
    if (!normalized.ok) return { kind: 'unavailable', path: '', absolute: null }

    const session = this.sessions.get(sessionId)?.session
    if (session?.protocol !== 'ssh' || !session?.pathStat) {
      return { kind: 'unavailable', path: normalized.value, absolute: null }
    }

    try {
      const stat = await session.pathStat.classifyPath(normalized.value)
      if (stat.kind === 'missing') {
        return { kind: 'missing', path: normalized.value, absolute: null }
      }
      if (stat.kind !== 'file' && stat.kind !== 'directory' && stat.kind !== 'other') {
        return { kind: 'unavailable', path: normalized.value, absolute: null }
      }
      const absolute = stat.absolute == null ? null : canonicalPosixDir(stat.absolute)
      if (absolute == null || !isSafePosixAbsolute(absolute)) {
        return { kind: 'unavailable', path: normalized.value, absolute: null }
      }
      const result = { kind: stat.kind, path: normalized.value, absolute }
      const checked = ClassifyPathResultSchema.safeParse(result)
      if (!checked.success) return { kind: 'unavailable', path: normalized.value, absolute: null }
      return checked.data
    } catch {
      return { kind: 'unavailable', path: normalized.value, absolute: null }
    }
  }

  writeStdin(sessionId: string, data: unknown): void {
    const session = this.sessions.get(sessionId)?.session
    const bytes = coerceBytes(data)
    if (!session?.terminal || !bytes) return
    session.terminal.write(bytes)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)?.session
    if (!session?.terminal) return
    const safeCols = Math.max(2, Math.min(cols || 80, 512))
    const safeRows = Math.max(1, Math.min(rows || 24, 256))
    session.terminal.resize(safeCols, safeRows)
  }

  /**
   * Best-effort Claude Code context/token usage for this session — works for
   * any local-shell/agent-workspace session where a `claude` process is
   * currently running somewhere under the shell (typed by the user or set
   * as the workspace's agent command), null otherwise or if Claude Code
   * hasn't written a transcript yet.
   */
  async getClaudeUsage(sessionId: string): Promise<ClaudeUsage | null> {
    const active = this.sessions.get(sessionId)
    const pid = active?.session.pid
    if (!pid) return null

    const claudePid = await findClaudeDescendantPid(pid)
    if (!claudePid) return null

    const cwd = await cwdForPid(claudePid)
    if (!cwd) return null

    const file = findActiveClaudeSessionFile(cwd, active.startedAt)
    if (!file) return null
    return readLatestClaudeUsage(file)
  }

  /** Renderer terminal mounted — flush any stdout buffered during handshake. */
  markStdoutReady(sessionId: string): void {
    this.stdoutReady.add(sessionId)
    const pending = this.stdoutBuffer.get(sessionId)
    this.stdoutBuffer.delete(sessionId)
    if (!pending?.length) return
    for (const message of pending) {
      this.events?.onSessionMessage?.(sessionId, message)
    }
  }

  private emitSessionMessage(sessionId: string, message: SessionPortMessage): void {
    if (this.stdoutReady.has(sessionId)) {
      this.events?.onSessionMessage?.(sessionId, message)
      return
    }
    const queue = this.stdoutBuffer.get(sessionId) ?? []
    if (queue.length >= 256) queue.shift()
    queue.push(message)
    this.stdoutBuffer.set(sessionId, queue)
  }

  async open(
    connectionId: string,
    _requestId: string,
    as?: 'sftp'
  ): Promise<{ descriptor: SessionDescriptor; port: MessagePortMain }> {
    // Captured once so a workspace switch mid-handshake can't mix sources.
    const source = this.sourceForOpen()
    const stored = await source.connection(connectionId)
    if (!stored) {
      throw new Error('Conexão não encontrada')
    }
    // SFTP rides the same SSH host/port/credentials, so an SSH connection can open its files.
    if (as === 'sftp' && stored.protocol !== 'ssh' && stored.protocol !== 'sftp') {
      throw new Error('Só conexões SSH podem abrir arquivos via SFTP')
    }
    const connection = as === 'sftp' ? { ...stored, protocol: 'sftp' as const } : stored

    const driver = this.drivers.get(connection.protocol)
    if (!driver) {
      throw new Error(`Protocolo não suportado: ${connection.protocol}`)
    }

    const sessionId = randomUUID()
    const descriptor: SessionDescriptor = {
      id: sessionId,
      connectionId,
      accessId: null,
      kind: driver.kind,
      protocol: connection.protocol,
      title: connection.name,
      state: 'connecting',
      errorMessage: null
    }

    const placeholder: ActiveSession = {
      session: {
        id: sessionId,
        kind: driver.kind,
        protocol: connection.protocol,
        state: 'connecting',
        attachPort: () => undefined,
        dispose: async () => undefined
      },
      descriptor,
      connectionId,
      accessId: null,
      startedAt: Date.now(),
      portMain: null,
      historyRecorded: false,
      everConnected: false,
      source: source.scope ? source : undefined
    }
    this.sessions.set(sessionId, placeholder)
    this.emitState(descriptor)

    try {
      // serial is local; behind a jump host only the jump needs to be reachable
      const probeTarget =
        connection.protocol === 'serial' || connection.jumpHostId
          ? undefined
          : { host: connection.host, port: connection.port }
      await this.vpnGate?.ensure(await source.vpnProfile(connectionId), sessionId, probeTarget)
      const session = await driver.createSession({
        connection,
        sessionId,
        resolveSecret: (ref) => source.resolveSecret(ref),
        verifyHostKey: (info) => this.verifyHostKey(sessionId, info)
      })

      const active = this.sessions.get(sessionId)
      if (!active) {
        await session.dispose()
        throw new Error('Sessão cancelada')
      }

      active.session = session
      if (session.state === 'connected') {
        active.everConnected = true
      }
      this.updateState(sessionId, session.state)

      const { port1, port2 } = this.createChannel()
      active.portMain = port1
      session.attachPort({
        postMessage: (message) => {
          try {
            port1.postMessage(message)
          } catch {
            // ignore closed port
          }
          this.emitSessionMessage(sessionId, message as SessionPortMessage)
        },
        close: () => port1.close(),
        start: () => port1.start(),
        on: (event, listener) => {
          port1.on(event, listener as (...args: unknown[]) => void)
        }
      })

      this.watchSessionLifecycle(sessionId)

      return { descriptor: { ...active.descriptor }, port: port2 }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao abrir sessão'
      this.updateState(sessionId, 'error', message)
      this.finishWithHistory(sessionId, false, message)
      throw error
    }
  }

  /** Local shell — no Connection/Access row, no credentials, no host-key verification. */
  async openLocal(): Promise<{ descriptor: SessionDescriptor; port: MessagePortMain }> {
    return this.openLocalShellSession({ title: 'Terminal local', protocol: 'local-shell' })
  }

  /** Agent workspace shell — cwd = worktree, initial command = the agent CLI. */
  async openAgentWorkspace(
    workspaceId: string
  ): Promise<{ descriptor: SessionDescriptor; port: MessagePortMain }> {
    const workspace = this.repositories.agentWorkspaces.get(workspaceId)
    if (!workspace) {
      throw new Error('Workspace de agente não encontrado')
    }
    return this.openLocalShellSession({
      title: `${workspace.repoName} · ${workspace.branch}`,
      protocol: 'agent-workspace',
      cwd: workspace.worktreePath,
      command: workspace.agentCommand
    })
  }

  private async openLocalShellSession(input: {
    title: string
    protocol: string
    cwd?: string
    command?: string
  }): Promise<{ descriptor: SessionDescriptor; port: MessagePortMain }> {
    const sessionId = randomUUID()
    const descriptor: SessionDescriptor = {
      id: sessionId,
      connectionId: null,
      accessId: null,
      kind: 'terminal',
      protocol: input.protocol,
      title: input.title,
      state: 'connecting',
      errorMessage: null
    }

    const placeholder: ActiveSession = {
      session: {
        id: sessionId,
        kind: 'terminal',
        protocol: input.protocol,
        state: 'connecting',
        attachPort: () => undefined,
        dispose: async () => undefined
      },
      descriptor,
      connectionId: null,
      accessId: null,
      startedAt: Date.now(),
      portMain: null,
      historyRecorded: false,
      everConnected: false
    }
    this.sessions.set(sessionId, placeholder)
    this.emitState(descriptor)

    try {
      const session = await this.localShellDriver.createSession(sessionId, {
        cwd: input.cwd,
        command: input.command
      })

      const active = this.sessions.get(sessionId)
      if (!active) {
        await session.dispose()
        throw new Error('Sessão cancelada')
      }

      active.session = session
      active.everConnected = true
      this.updateState(sessionId, 'connected')

      const { port1, port2 } = this.createChannel()
      active.portMain = port1
      session.attachPort({
        postMessage: (message) => {
          try {
            port1.postMessage(message)
          } catch {
            // ignore closed port
          }
          this.emitSessionMessage(sessionId, message as SessionPortMessage)
        },
        close: () => port1.close(),
        start: () => port1.start(),
        on: (event, listener) => {
          port1.on(event, listener as (...args: unknown[]) => void)
        }
      })

      this.watchSessionLifecycle(sessionId)

      return { descriptor: { ...active.descriptor }, port: port2 }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao abrir sessão'
      this.updateState(sessionId, 'error', message)
      this.finishWithHistory(sessionId, false, message)
      throw error
    }
  }

  /** The active organization's access source, or null for the personal workspace. */
  private organizationAccessSource(): ConnectionSource | null {
    const source = this.connectionSource?.() ?? null
    return source?.access ? source : null
  }

  private async findAccess(accessId: string): Promise<Access | null> {
    const source = this.organizationAccessSource()
    return source?.access ? source.access(accessId) : this.repositories.accesses.get(accessId)
  }

  async openAccess(accessId: string): Promise<{ descriptor: SessionDescriptor }> {
    const access = await this.findAccess(accessId)
    if (!access) {
      throw new Error('Acesso não encontrado')
    }

    if (access.type === 'api') {
      return this.openApiAccess(accessId, access.name)
    }

    if (access.type === 'database' && isSqlStudioEngine(access.engine)) {
      return this.openDatabaseAccess(accessId, access)
    }

    throw new Error('Este acesso não abre sessão SQL no North')
  }

  private async openApiAccess(
    accessId: string,
    title: string
  ): Promise<{ descriptor: SessionDescriptor }> {
    const sessionId = randomUUID()
    const descriptor: SessionDescriptor = {
      id: sessionId,
      connectionId: null,
      accessId,
      kind: 'api',
      protocol: 'api',
      title,
      state: 'connecting',
      errorMessage: null
    }

    const placeholder: ActiveSession = {
      session: {
        id: sessionId,
        kind: 'api',
        protocol: 'api',
        state: 'connecting',
        attachPort: () => undefined,
        dispose: async () => undefined
      },
      descriptor,
      connectionId: null,
      accessId,
      startedAt: Date.now(),
      portMain: null,
      historyRecorded: false,
      everConnected: false
    }
    this.sessions.set(sessionId, placeholder)
    this.emitState(descriptor)

    try {
      // requests run in main, so the tunnel must be up before the first one
      await this.vpnGate?.ensure(this.vpnGate.profileForAccess(accessId), sessionId)
      const session = new ApiProtocolSession(sessionId, accessId, this.repositories, this.vault)
      session.state = 'connected'

      const active = this.sessions.get(sessionId)
      if (!active) {
        await session.dispose()
        throw new Error('Sessão cancelada')
      }

      active.session = session
      active.everConnected = true
      this.updateState(sessionId, 'connected')
      this.watchSessionLifecycle(sessionId)

      return { descriptor: { ...active.descriptor } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao abrir sessão'
      this.updateState(sessionId, 'error', message)
      this.finishWithHistory(sessionId, false, message)
      throw error
    }
  }

  private async openDatabaseAccess(
    accessId: string,
    access: { name: string; engine: string | null; credentialRef: string | null }
  ): Promise<{ descriptor: SessionDescriptor }> {
    const sessionId = randomUUID()
    const protocol = access.engine as string
    const descriptor: SessionDescriptor = {
      id: sessionId,
      connectionId: null,
      accessId,
      kind: 'database',
      protocol,
      title: access.name,
      state: 'connecting',
      errorMessage: null
    }

    const placeholder: ActiveSession = {
      session: {
        id: sessionId,
        kind: 'database',
        protocol,
        state: 'connecting',
        attachPort: () => undefined,
        dispose: async () => undefined
      },
      descriptor,
      connectionId: null,
      accessId,
      // an organization's access ends with its grant or sign-out, like its connections
      source: this.organizationAccessSource() ?? undefined,
      startedAt: Date.now(),
      portMain: null,
      historyRecorded: false,
      everConnected: false
    }
    this.sessions.set(sessionId, placeholder)
    this.emitState(descriptor)

    try {
      const organization = this.organizationAccessSource()
      const full = await this.findAccess(accessId)
      if (!full) throw new Error('Acesso não encontrado')
      const vpnProfile = organization?.accessVpnProfile
        ? await organization.accessVpnProfile(accessId)
        : (this.vpnGate?.profileForAccess(accessId) ?? null)
      await this.vpnGate?.ensure(
        vpnProfile,
        sessionId,
        full.host && full.port ? { host: full.host, port: full.port } : undefined
      )
      let password: string | null = null
      if (full.credentialRef) {
        password = organization
          ? await organization.resolveSecret(full.credentialRef)
          : await this.vault.resolveSecret(full.credentialRef)
      }
      const config = configFromAccess(full, password)
      const adapter = await connectAdapter(config)
      const session = new DatabaseProtocolSession(sessionId, protocol, adapter)
      session.state = 'connected'

      const active = this.sessions.get(sessionId)
      if (!active) {
        await session.dispose()
        throw new Error('Sessão cancelada')
      }

      active.session = session
      active.everConnected = true
      this.updateState(sessionId, 'connected')
      this.watchSessionLifecycle(sessionId)

      return { descriptor: { ...active.descriptor } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao abrir sessão'
      this.updateState(sessionId, 'error', message)
      this.finishWithHistory(sessionId, false, message)
      throw error
    }
  }

  async close(sessionId: string): Promise<void> {
    releaseSessionTransfers(sessionId)
    await disposeRemoteEdits(sessionId)
    const active = this.sessions.get(sessionId)
    if (!active) return

    const success = active.everConnected
    try {
      await active.session.dispose()
    } catch {
      // ignore dispose errors
    }

    this.updateState(sessionId, 'closed')
    this.finishWithHistory(sessionId, success, null)
  }

  /**
   * Organization push (ADR 0018 fase 5): asks the source again for each open
   * session of that workspace and ends the ones the user can no longer reach.
   */
  async revalidate(scope: string): Promise<number> {
    let ended = 0
    for (const [sessionId, active] of [...this.sessions]) {
      if (active.source?.scope !== scope) continue
      const { source } = active
      const still = active.connectionId
        ? await source.connection(active.connectionId).catch(() => null)
        : active.accessId && source.access
          ? await source.access(active.accessId).catch(() => null)
          : true
      if (!still) {
        await this.endWith(
          sessionId,
          active.connectionId
            ? 'Seu acesso a esta conexão foi removido.'
            : 'Você não tem mais permissão para este acesso.'
        )
        ended++
      }
    }
    return ended
  }

  /** Ends every session opened from a workspace (signed out or revoked). */
  async closeScope(scope: string, message: string): Promise<void> {
    const ids = [...this.sessions].filter(([, a]) => a.source?.scope === scope).map(([id]) => id)
    await Promise.all(ids.map((id) => this.endWith(id, message)))
  }

  private async endWith(sessionId: string, message: string): Promise<void> {
    await disposeRemoteEdits(sessionId)
    const active = this.sessions.get(sessionId)
    if (!active) return
    try {
      await active.session.dispose()
    } catch {
      // ignore dispose errors
    }
    this.updateState(sessionId, 'error', message)
    this.finishWithHistory(sessionId, active.everConnected, message)
  }

  respondHostKey(response: HostKeyResponse): void {
    const pending = this.pendingHostKeys.get(response.requestId)
    if (!pending) return
    this.pendingHostKeys.delete(response.requestId)

    if (response.accept) {
      this.repositories.knownHosts.upsert({
        host: pending.host,
        port: pending.port,
        keyType: pending.keyType,
        fingerprint: pending.fingerprint,
        publicKey: pending.hostKey
      })
    }

    pending.resolve(response.accept)
  }

  async disposeAll(): Promise<void> {
    const ids = [...this.sessions.keys()]
    await Promise.all(ids.map((id) => this.close(id)))
  }

  private async verifyHostKey(
    sessionId: string,
    info: {
      host: string
      port: number
      keyType: string
      fingerprint: string
      hostKey: Uint8Array
    },
    kind: 'session' | 'log-follow' = 'session'
  ): Promise<boolean> {
    const keyType = info.keyType !== 'unknown' ? info.keyType : parseHostKeyType(info.hostKey)
    const fingerprint = info.fingerprint || fingerprintHostKey(info.hostKey)
    const hostKey = Buffer.from(info.hostKey)

    const existing = this.repositories.knownHosts.get(info.host, info.port, keyType)
    if (existing && existing.fingerprint === fingerprint) {
      return true
    }

    const isMismatch = Boolean(existing && existing.fingerprint !== fingerprint)
    const requestId = randomUUID()

    const accepted = await new Promise<boolean>((resolve) => {
      this.pendingHostKeys.set(requestId, {
        resolve,
        host: info.host,
        port: info.port,
        keyType,
        fingerprint,
        hostKey
      })

      const prompt: HostKeyPrompt = {
        requestId,
        sessionId,
        host: info.host,
        port: info.port,
        keyType,
        fingerprint,
        previousFingerprint: existing?.fingerprint ?? null,
        isMismatch,
        kind
      }

      this.events?.onHostKeyPrompt(prompt)
    })

    return accepted
  }

  private watchSessionLifecycle(sessionId: string): void {
    const timer = setInterval(() => {
      const active = this.sessions.get(sessionId)
      if (!active) {
        clearInterval(timer)
        return
      }

      if (active.session.state === 'connected') {
        active.everConnected = true
      }

      if (active.session.state !== active.descriptor.state) {
        this.updateState(sessionId, active.session.state)
      }

      if (active.session.state === 'closed' || active.session.state === 'error') {
        clearInterval(timer)
        const success = active.everConnected && active.session.state === 'closed'
        this.finishWithHistory(sessionId, success, active.descriptor.errorMessage ?? null)
      }
    }, 400)
  }

  private updateState(sessionId: string, state: SessionState, errorMessage?: string | null): void {
    const active = this.sessions.get(sessionId)
    if (!active) return
    if (state === 'connected') {
      active.everConnected = true
    }
    active.descriptor = {
      ...active.descriptor,
      state,
      errorMessage:
        errorMessage === undefined ? (active.descriptor.errorMessage ?? null) : errorMessage
    }
    this.emitState(active.descriptor)
  }

  private emitState(descriptor: SessionDescriptor): void {
    this.events?.onStateChanged({ ...descriptor })
  }

  private finishWithHistory(
    sessionId: string,
    success: boolean,
    errorMessage: string | null
  ): void {
    const active = this.sessions.get(sessionId)
    if (!active) return

    if (!active.historyRecorded) {
      active.historyRecorded = true
      const durationMs = Math.max(0, Date.now() - active.startedAt)
      try {
        if (active.accessId) {
          this.repositories.history.recordAccess({
            accessId: active.accessId,
            connectedAt: new Date(active.startedAt).toISOString(),
            durationMs,
            success,
            errorMessage
          })
        } else if (active.connectionId) {
          this.repositories.history.record({
            connectionId: active.connectionId,
            connectedAt: new Date(active.startedAt).toISOString(),
            durationMs,
            success,
            errorMessage
          })
        }
      } catch {
        // history must not break session teardown
      }
    }

    this.sessions.delete(sessionId)
    this.vpnGate?.release(sessionId)
    this.stdoutReady.delete(sessionId)
    this.stdoutBuffer.delete(sessionId)
  }
}
