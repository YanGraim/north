import { randomUUID } from 'node:crypto'
import {
  coerceBytes,
  type HostKeyPrompt,
  type HostKeyResponse,
  isSqlStudioEngine,
  type ProtocolDriver,
  type ProtocolSession,
  type SessionDescriptor,
  type SessionPortMessage,
  type SessionState
} from '@shared/protocols'
import type { MessagePortMain, WebContents } from 'electron'
import { MessageChannelMain } from 'electron'
import { ApiProtocolSession } from '../protocols/api/session'
import { configFromAccess } from '../protocols/database/config'
import { connectAdapter } from '../protocols/database/registry'
import { DatabaseProtocolSession } from '../protocols/database/session'
import { fingerprintHostKey, parseHostKeyType } from '../protocols/ssh-utils'
import type { Repositories } from '../repositories'
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
}

export type ProtocolManagerEvents = {
  onStateChanged: (descriptor: SessionDescriptor) => void
  onHostKeyPrompt: (prompt: HostKeyPrompt) => void
  /** Bridged terminal stream (also mirrors MessagePort outbound). */
  onSessionMessage?: (sessionId: string, message: SessionPortMessage) => void
}

export type MessageChannelFactory = () => { port1: MessagePortMain; port2: MessagePortMain }

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
  private readonly createChannel: MessageChannelFactory

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
    _requestId: string
  ): Promise<{ descriptor: SessionDescriptor; port: MessagePortMain }> {
    const connection = this.repositories.connections.get(connectionId)
    if (!connection) {
      throw new Error('Conexão não encontrada')
    }

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
      everConnected: false
    }
    this.sessions.set(sessionId, placeholder)
    this.emitState(descriptor)

    try {
      const session = await driver.createSession({
        connection,
        sessionId,
        resolveSecret: (ref) => this.vault.resolveSecret(ref),
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

  async openAccess(accessId: string): Promise<{ descriptor: SessionDescriptor }> {
    const access = this.repositories.accesses.get(accessId)
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
      startedAt: Date.now(),
      portMain: null,
      historyRecorded: false,
      everConnected: false
    }
    this.sessions.set(sessionId, placeholder)
    this.emitState(descriptor)

    try {
      const full = this.repositories.accesses.get(accessId)
      if (!full) throw new Error('Acesso não encontrado')
      let password: string | null = null
      if (full.credentialRef) {
        password = await this.vault.resolveSecret(full.credentialRef)
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
    }
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
        isMismatch
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
    this.stdoutReady.delete(sessionId)
    this.stdoutBuffer.delete(sessionId)
  }
}
