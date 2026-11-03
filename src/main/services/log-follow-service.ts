import { randomUUID } from 'node:crypto'
import { ByteRing } from '@shared/lib/byte-ring'
import {
  absoluteLogPath,
  buildTailFollowCommand,
  LOG_FOLLOW_LIMIT,
  LOG_FOLLOW_RING_BYTES,
  normalizeLogFilePath,
  sanitizeLogStderr
} from '@shared/lib/log-file'
import type { Connection } from '@shared/types'
import type {
  LogFollowErrorCode,
  LogFollowSnapshot,
  LogFollowStartResult,
  LogFollowState
} from '@shared/types/log-follow'
import type { FollowClient, FollowConnector, FollowExec, HostKeyInfo } from './log-follow-ssh'

type LoadedConnection = {
  connection: Connection
  resolveSecret: (credentialRef: string) => Promise<string>
}

export type LogFollowDeps = {
  load(connectionId: string): Promise<LoadedConnection | null>
  ensureVpn(connection: Connection, followId: string): Promise<void>
  releaseVpn(followId: string): void
  confirmHostKey(followId: string, info: HostKeyInfo): Promise<boolean>
  focusMain(): void
  focusWindow(followId: string): void
  connector: FollowConnector
  onChanged(follows: LogFollowSnapshot[]): void
  onBytes(followId: string, seq: number, bytes: Uint8Array): void
  onReset(followId: string): void
}

type ActiveFollow = {
  id: string
  connectionId: string
  logFileId: string | null
  /** Selection follows are not stored on the connection and do not consume the saved limit. */
  ephemeral: boolean
  connectionName: string
  label: string | null
  path: string
  placement: 'dock' | 'window'
  state: LogFollowState
  errorCode: LogFollowErrorCode | null
  runId: number
  focusNonce: number
  generation: number
  /** Last chunk sequence published. Replay returns this plus the ring. */
  seq: number
  removed: boolean
  ring: ByteRing
  client: FollowClient | null
  exec: FollowExec | null
}

function failureCode(error: unknown, hostKeyRejected: boolean): LogFollowErrorCode {
  if (hostKeyRejected) return 'HOST_KEY_REJECTED'
  const message = error instanceof Error ? error.message : ''
  if (/auth|senha|password|passphrase|agent|chave privada/i.test(message)) return 'AUTH_FAILED'
  return 'CONNECTION_LOST'
}

function needsHome(path: string): boolean {
  return path === '~' || path.startsWith('~/')
}

export class LogFollowService {
  private readonly follows = new Map<string, ActiveFollow>()
  private pending: Promise<void> = Promise.resolve()

  constructor(private readonly deps: LogFollowDeps) {}

  list(): LogFollowSnapshot[] {
    return [...this.follows.values()].map((follow) => this.snapshot(follow))
  }

  /** Test helper: waits until in-flight connects settle. */
  async idle(): Promise<void> {
    await this.pending
  }

  async start(connectionId: string, logFileId: string): Promise<LogFollowStartResult> {
    const wanted = logFileId.toLowerCase()
    const byId = this.findByLogFileId(connectionId, wanted)
    if (byId) return this.focus(byId)

    const loaded = await this.deps.load(connectionId)
    if (!loaded) return { ok: false, code: 'NOT_FOUND' }
    if (loaded.connection.protocol !== 'ssh') return { ok: false, code: 'NOT_SSH' }
    const file = loaded.connection.logFiles.find((item) => item.id === wanted)
    const normalized = file ? normalizeLogFilePath(file.path) : null
    if (normalized?.ok) {
      const byPath = this.findByPath(connectionId, normalized.value)
      if (byPath) return this.focus(byPath)
    }
    if (this.savedCount() >= LOG_FOLLOW_LIMIT) return { ok: false, code: 'LIMIT' }
    if (!file || !normalized?.ok) return { ok: false, code: 'NOT_FOUND' }

    return this.open(loaded, {
      connectionId,
      logFileId: file.id,
      label: file.label,
      path: normalized.value,
      ephemeral: false
    })
  }

  /** Follows an unstored path. The same normalized path focuses the live follow. */
  async startPath(connectionId: string, path: string): Promise<LogFollowStartResult> {
    const normalized = normalizeLogFilePath(path)
    if (!normalized.ok) return { ok: false, code: 'INVALID_PATH' }
    const existing = this.findByPath(connectionId, normalized.value)
    if (existing) return this.focus(existing)

    const loaded = await this.deps.load(connectionId)
    if (!loaded) return { ok: false, code: 'NOT_FOUND' }
    if (loaded.connection.protocol !== 'ssh') return { ok: false, code: 'NOT_SSH' }

    return this.open(loaded, {
      connectionId,
      logFileId: null,
      label: null,
      path: normalized.value,
      ephemeral: true
    })
  }

  retry(followId: string): LogFollowSnapshot | null {
    const follow = this.follows.get(followId)
    if (!follow) return null
    follow.generation += 1
    follow.runId += 1
    this.endClient(follow)
    this.deps.releaseVpn(follow.id)
    follow.ring.clear()
    follow.seq = 0
    this.deps.onReset(follow.id)
    follow.state = 'connecting'
    follow.errorCode = null
    this.emit()
    this.track(this.reload(follow))
    return this.snapshot(follow)
  }

  replay(followId: string): { seq: number; data: number[] } | null {
    const follow = this.follows.get(followId)
    if (!follow) return null
    return { seq: follow.seq, data: Array.from(follow.ring.snapshot()) }
  }

  setPlacement(followId: string, placement: 'dock' | 'window'): LogFollowSnapshot | null {
    const follow = this.follows.get(followId)
    if (!follow) return null
    follow.placement = placement
    this.emit()
    return this.snapshot(follow)
  }

  async stop(followId: string): Promise<void> {
    const follow = this.follows.get(followId)
    if (!follow) return
    follow.removed = true
    follow.generation += 1
    this.follows.delete(followId)
    this.endClient(follow)
    this.deps.releaseVpn(followId)
    this.emit()
  }

  async stopConnection(connectionId: string): Promise<void> {
    const ids = [...this.follows.values()]
      .filter((follow) => follow.connectionId === connectionId)
      .map((follow) => follow.id)
    await Promise.all(ids.map((id) => this.stop(id)))
  }

  async disposeAll(): Promise<void> {
    const ids = [...this.follows.keys()]
    await Promise.all(ids.map((id) => this.stop(id)))
  }

  private launch(follow: ActiveFollow, loaded: LoadedConnection, path: string): void {
    this.track(this.run(follow, loaded, path, follow.generation))
  }

  private async reload(follow: ActiveFollow): Promise<void> {
    const generation = follow.generation
    const loaded = await this.deps.load(follow.connectionId)
    if (follow.generation !== generation || follow.removed) return
    if (follow.ephemeral) {
      if (!loaded) {
        this.fail(follow, 'NOT_FOUND')
        return
      }
      if (loaded.connection.protocol !== 'ssh') {
        this.fail(follow, 'NOT_SSH')
        return
      }
      follow.connectionName = loaded.connection.name
      await this.run(follow, loaded, follow.path, generation)
      return
    }
    const file = loaded?.connection.logFiles.find((item) => item.id === follow.logFileId)
    if (loaded?.connection.protocol !== 'ssh' || !file) {
      this.fail(follow, 'NOT_FOUND')
      return
    }
    follow.connectionName = loaded.connection.name
    follow.label = file.label
    follow.path = file.path
    await this.run(follow, loaded, file.path, generation)
  }

  private async run(
    follow: ActiveFollow,
    loaded: LoadedConnection,
    path: string,
    generation: number
  ): Promise<void> {
    let hostKeyRejected = false
    const stale = (): boolean => follow.removed || follow.generation !== generation
    try {
      this.deps.releaseVpn(follow.id)
      await this.deps.ensureVpn(loaded.connection, follow.id)
      if (stale()) {
        this.deps.releaseVpn(follow.id)
        return
      }
      const client = await this.deps.connector.open({
        connection: loaded.connection,
        resolveSecret: loaded.resolveSecret,
        verifyHostKey: async (info) => {
          if (stale()) return false
          this.setState(follow, 'awaiting-host-key')
          this.deps.focusMain()
          const accepted = await this.deps.confirmHostKey(follow.id, info)
          if (!accepted) hostKeyRejected = true
          return accepted
        }
      })
      if (stale()) {
        client.end()
        this.deps.releaseVpn(follow.id)
        return
      }
      follow.client = client
      client.onDisconnect((error) => {
        if (stale()) return
        this.fail(follow, failureCode(error, false))
      })
      const home = needsHome(path) ? await client.homeDirectory() : null
      if (stale()) {
        this.endClient(follow)
        this.deps.releaseVpn(follow.id)
        return
      }
      const absolute = absoluteLogPath(path, home)
      if (!absolute) {
        this.fail(follow, 'PATH_UNRESOLVED')
        return
      }
      const exec = await client.exec(buildTailFollowCommand(absolute))
      if (stale()) {
        exec.close()
        this.endClient(follow)
        this.deps.releaseVpn(follow.id)
        return
      }
      follow.exec = exec
      exec.onStdout((chunk) => this.push(follow, generation, chunk))
      exec.onStderr((chunk) => this.push(follow, generation, sanitizeLogStderr(chunk)))
      exec.onExit((code) => {
        if (stale()) return
        this.fail(follow, code === 127 ? 'TAIL_MISSING' : 'TAIL_EXITED')
      })
      if (stale()) return
      this.setState(follow, 'live')
    } catch (error) {
      if (stale()) return
      this.fail(follow, failureCode(error, hostKeyRejected))
    }
  }

  private push(follow: ActiveFollow, generation: number, chunk: Uint8Array): void {
    if (follow.removed || follow.generation !== generation || chunk.byteLength === 0) return
    follow.seq += 1
    follow.ring.push(chunk)
    this.deps.onBytes(follow.id, follow.seq, chunk)
  }

  private fail(follow: ActiveFollow, code: LogFollowErrorCode): void {
    if (follow.removed || follow.state === 'error') return
    follow.state = 'error'
    follow.errorCode = code
    this.endClient(follow)
    this.deps.releaseVpn(follow.id)
    this.emit()
  }

  private setState(follow: ActiveFollow, state: LogFollowState): void {
    if (follow.removed || follow.state === 'error') return
    follow.state = state
    follow.errorCode = null
    this.emit()
  }

  private endClient(follow: ActiveFollow): void {
    follow.exec?.close()
    follow.exec = null
    follow.client?.end()
    follow.client = null
  }

  private savedCount(): number {
    let count = 0
    for (const follow of this.follows.values()) {
      if (!follow.ephemeral) count += 1
    }
    return count
  }

  private findByLogFileId(connectionId: string, logFileId: string): ActiveFollow | undefined {
    for (const follow of this.follows.values()) {
      if (follow.connectionId === connectionId && follow.logFileId === logFileId) return follow
    }
    return undefined
  }

  private findByPath(connectionId: string, path: string): ActiveFollow | undefined {
    for (const follow of this.follows.values()) {
      if (follow.connectionId === connectionId && follow.path === path) return follow
    }
    return undefined
  }

  private focus(follow: ActiveFollow): LogFollowStartResult {
    follow.focusNonce += 1
    if (follow.placement === 'window') this.deps.focusWindow(follow.id)
    else this.deps.focusMain()
    this.emit()
    return { ok: true, snapshot: this.snapshot(follow), alreadyOpen: true }
  }

  private open(
    loaded: LoadedConnection,
    fields: {
      connectionId: string
      logFileId: string | null
      label: string | null
      path: string
      ephemeral: boolean
    }
  ): LogFollowStartResult {
    const follow: ActiveFollow = {
      id: randomUUID(),
      connectionId: fields.connectionId,
      logFileId: fields.logFileId,
      ephemeral: fields.ephemeral,
      connectionName: loaded.connection.name,
      label: fields.label,
      path: fields.path,
      placement: 'dock',
      state: 'connecting',
      errorCode: null,
      runId: 1,
      focusNonce: 0,
      generation: 1,
      seq: 0,
      removed: false,
      ring: new ByteRing(LOG_FOLLOW_RING_BYTES),
      client: null,
      exec: null
    }
    this.follows.set(follow.id, follow)
    this.emit()
    this.launch(follow, loaded, fields.path)
    return { ok: true, snapshot: this.snapshot(follow), alreadyOpen: false }
  }

  private snapshot(follow: ActiveFollow): LogFollowSnapshot {
    return {
      id: follow.id,
      connectionId: follow.connectionId,
      logFileId: follow.logFileId,
      ephemeral: follow.ephemeral,
      connectionName: follow.connectionName,
      label: follow.label,
      path: follow.path,
      placement: follow.placement,
      state: follow.state,
      errorCode: follow.errorCode,
      runId: follow.runId,
      focusNonce: follow.focusNonce
    }
  }

  private emit(): void {
    this.deps.onChanged(this.list())
  }

  private track(task: Promise<void>): void {
    this.pending = this.pending.then(() => task).catch(() => undefined)
  }
}
