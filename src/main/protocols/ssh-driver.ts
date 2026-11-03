import { normalizeLogFilePath } from '@shared/lib/log-file'
import { isSafePosixAbsolute, type PathStatResult } from '@shared/lib/selection-path'
import {
  canonicalPosixDir,
  normalizeStartupDirectory,
  planStartupDirectory,
  resolveStartupDirectory,
  STARTUP_DIRECTORY_INVALID_NOTICE,
  type StartupDirectoryPlan,
  startupDirectoryUnavailableNotice
} from '@shared/lib/startup-directory'
import {
  type ConnectOptions,
  coerceBytes,
  type DirectoryListCapability,
  type PathStatCapability,
  type ProtocolDriver,
  type ProtocolSession,
  type SessionDataPort,
  type SessionPortMessage,
  type SessionState,
  type TerminalCapability
} from '@shared/protocols'
import { Client, type ClientChannel, type SFTPWrapper, type ShellOptions, type Stats } from 'ssh2'
import { SessionPortOutlet } from './session-port-outlet'
import { attachKeyboardInteractivePassword, buildSshConnectConfig } from './ssh-auth'
import { listRemoteDirectory } from './ssh-directory-list'
import { readLoginShell, runSavedShellStartup } from './ssh-osc7-hook'
import { formatSshClientError } from './ssh-utils'

class SshProtocolSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'terminal' as const
  readonly protocol = 'ssh'
  private _state: SessionState = 'connecting'
  private port: SessionDataPort | null = null
  private readonly outlet = new SessionPortOutlet()
  private stream: ClientChannel | null = null
  private readonly client: Client
  private disposed = false
  private onDisposed: (() => void) | null = null

  readonly terminal: TerminalCapability = {
    write: (data: Uint8Array): void => {
      this.stream?.write(Buffer.from(data))
    },
    resize: (cols: number, rows: number): void => {
      this.stream?.setWindow(rows, cols, 0, 0)
    }
  }

  /** Stat on this session's client. Does not write to the PTY. */
  readonly pathStat: PathStatCapability = {
    classifyPath: (path: string): Promise<PathStatResult> =>
      classifyRemotePath(this.client, path, () => this.disposed)
  }

  /** One `readdir` on this session's client. Does not write to the PTY or change session state. */
  readonly listDirectory: DirectoryListCapability = {
    list: (path: string) => listRemoteDirectory(this.client, path, () => this.disposed)
  }

  constructor(id: string, client: Client) {
    this.id = id
    this.client = client
  }

  get state(): SessionState {
    return this._state
  }

  onDispose(cb: () => void): void {
    this.onDisposed = cb
  }

  setState(state: SessionState, errorMessage?: string | null): void {
    this._state = state
    this.post({ type: 'state', state, errorMessage: errorMessage ?? null })
  }

  attachPort(port: SessionDataPort): void {
    this.port = port
    port.on('message', (event) => {
      const message = event.data as SessionPortMessage
      if (!message || typeof message !== 'object') return

      if (message.type === 'data') {
        const bytes = coerceBytes(message.data)
        if (bytes) this.terminal.write(bytes)
        return
      }

      if (message.type === 'resize') {
        this.terminal.resize(message.cols, message.rows)
      }
    })
    port.start()
    this.outlet.attach(port)
    this.post({ type: 'state', state: this._state })
  }

  attachStream(stream: ClientChannel): void {
    this.stream = stream
    stream.on('data', (chunk: Buffer) => {
      const copy = Uint8Array.from(chunk)
      this.post({ type: 'data', data: copy })
    })
    stream.stderr?.on('data', (chunk: Buffer) => {
      const copy = Uint8Array.from(chunk)
      this.post({ type: 'data', data: copy })
    })
    stream.on('close', () => {
      void this.dispose()
    })
  }

  /** A yellow line in the terminal, like the warnings `ssh -A` prints. */
  notice(text: string): void {
    this.post({
      type: 'data',
      data: new TextEncoder().encode(`\x1b[33m[North] ${text}\x1b[0m\r\n`)
    })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this._state = 'closed'
    this.post({ type: 'state', state: 'closed' })
    try {
      this.stream?.close()
    } catch {
      // ignore
    }
    try {
      this.client.end()
    } catch {
      // ignore
    }
    try {
      this.port?.close()
    } catch {
      // ignore
    }
    this.stream = null
    this.port = null
    this.outlet.detach()
    this.onDisposed?.()
  }

  private post(message: SessionPortMessage): void {
    this.outlet.post(message)
  }
}

const AGENT_MISSING_NOTICE =
  process.platform === 'win32'
    ? 'Encaminhamento do agente SSH desligado: nenhum agente encontrado. Habilite o serviço "OpenSSH Authentication Agent" e rode ssh-add.'
    : 'Encaminhamento do agente SSH desligado: nenhum agente encontrado (SSH_AUTH_SOCK). Rode ssh-add.'
const AGENT_REFUSED_NOTICE =
  'O servidor recusou o encaminhamento do agente SSH (veja AllowAgentForwarding no sshd_config).'

function enactStartupPlan(
  stream: ClientChannel,
  plan: StartupDirectoryPlan,
  isCancelled: () => boolean
): string | null {
  if (isCancelled()) return null
  if (plan.kind === 'cd') {
    stream.write(plan.command)
    return null
  }
  return plan.kind === 'notice' ? plan.message : null
}

/** ssh2 sets `error.code` to the SFTP status. 2 is SSH_FX_NO_SUCH_FILE. The message is never forwarded. */
const SFTP_NO_SUCH_FILE = 2

function isNoSuchFile(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return (error as { code: unknown }).code === SFTP_NO_SUCH_FILE
}

/**
 * Classifies `path` with a short SFTP `stat` on the client that already owns the shell.
 * `stat` follows a symlink only to decide file vs directory. The returned absolute is the
 * selection with `~` resolved from `realpath('.')`. The target itself is not realpath'd.
 * ENOENT is `missing`. Any other channel or stat failure is `unavailable`.
 */
async function classifyRemotePath(
  client: Client,
  path: string,
  isCancelled: () => boolean
): Promise<PathStatResult> {
  const normalized = normalizeLogFilePath(path)
  if (!normalized.ok || isCancelled()) return { kind: 'unavailable', absolute: null }

  let sftp: SFTPWrapper
  try {
    sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((err, channel) => (err ? reject(err) : resolve(channel)))
    })
  } catch {
    return { kind: 'unavailable', absolute: null }
  }

  try {
    if (isCancelled()) return { kind: 'unavailable', absolute: null }
    const login = await new Promise<string>((resolve, reject) => {
      sftp.realpath('.', (err, resolved) => (err ? reject(err) : resolve(resolved)))
    })
    if (isCancelled()) return { kind: 'unavailable', absolute: null }
    const target = canonicalPosixDir(resolveStartupDirectory(normalized.value, login))
    if (!isSafePosixAbsolute(target)) return { kind: 'unavailable', absolute: null }
    try {
      const stats = await new Promise<Stats>((resolve, reject) => {
        sftp.stat(target, (err, value) => (err ? reject(err) : resolve(value)))
      })
      const kind = stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other'
      return { kind, absolute: target }
    } catch (error) {
      if (isNoSuchFile(error)) return { kind: 'missing', absolute: null }
      return { kind: 'unavailable', absolute: null }
    }
  } catch {
    return { kind: 'unavailable', absolute: null }
  } finally {
    try {
      sftp.end()
    } catch {
      // The auxiliary channel is best-effort.
    }
  }
}

/** Confirms the directory over a short-lived SFTP channel, then cds or warns. Never fails the session. */
async function applyStartupDirectory(
  client: Client,
  stream: ClientChannel,
  raw: string | null,
  isCancelled: () => boolean
): Promise<string | null> {
  const normalized = normalizeStartupDirectory(raw)
  if (!normalized.ok) return STARTUP_DIRECTORY_INVALID_NOTICE
  if (normalized.value === null) return null

  let sftp: SFTPWrapper
  try {
    sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((err, channel) => (err ? reject(err) : resolve(channel)))
    })
  } catch {
    return enactStartupPlan(
      stream,
      planStartupDirectory({ raw, probe: { status: 'unavailable' } }),
      isCancelled
    )
  }

  try {
    const login = await new Promise<string>((resolve, reject) => {
      sftp.realpath('.', (err, path) => (err ? reject(err) : resolve(path)))
    })
    const target = resolveStartupDirectory(normalized.value, login)
    let targetIsDirectory = canonicalPosixDir(target) === canonicalPosixDir(login)
    if (!targetIsDirectory) {
      try {
        const stats = await new Promise<Stats>((resolve, reject) => {
          sftp.stat(target, (err, value) => (err ? reject(err) : resolve(value)))
        })
        targetIsDirectory = stats.isDirectory()
      } catch {
        targetIsDirectory = false
      }
    }
    return enactStartupPlan(
      stream,
      planStartupDirectory({
        raw,
        probe: { status: 'ready', loginDirectory: login, targetIsDirectory }
      }),
      isCancelled
    )
  } catch {
    if (isCancelled()) return null
    return startupDirectoryUnavailableNotice(normalized.value)
  } finally {
    try {
      sftp.end()
    } catch {
      // The auxiliary channel is best-effort.
    }
  }
}

export class SshDriver implements ProtocolDriver {
  readonly id = 'ssh'
  readonly protocols = ['ssh']
  readonly kind = 'terminal' as const

  async createSession(opts: ConnectOptions): Promise<ProtocolSession> {
    const { sessionId } = opts
    const client = new Client()
    const session = new SshProtocolSession(sessionId, client)
    const connectConfig = await buildSshConnectConfig(opts)
    if (typeof connectConfig.password === 'string') {
      attachKeyboardInteractivePassword(client, connectConfig.password)
    }

    await new Promise<void>((resolveConnect, rejectConnect) => {
      let settled = false
      client
        .on('ready', () => {
          let agentNotice: string | null = null
          const pty = { term: 'xterm-256color', cols: 80, rows: 24 }
          const openShell = (forwardAgent: boolean): void => {
            // Per-channel request (not ConnectConfig.agentForward) so a server that
            // refuses forwarding still gets a shell — same as `ssh -A`, which just warns.
            // ssh2 honors `agentForward` per channel; @types/ssh2 just doesn't declare it.
            const shellOpts = { agentForward: forwardAgent } as ShellOptions
            client.shell(pty, shellOpts, (err, stream) => {
              if (settled) return
              if (err && forwardAgent && /agent forwarding/i.test(err.message)) {
                agentNotice = AGENT_REFUSED_NOTICE
                openShell(false)
                return
              }
              onShell(err, stream)
            })
          }
          const onShell = (err: Error | undefined, stream: ClientChannel): void => {
            if (settled) return
            if (err) {
              settled = true
              const formatted = formatSshClientError(err)
              session.setState('error', formatted.message)
              rejectConnect(formatted)
              return
            }
            session.attachStream(stream)
            void (async () => {
              const startupNotice = await runSavedShellStartup({
                connectionId: opts.connection.id,
                isCancelled: () => settled,
                applyStartup: () =>
                  applyStartupDirectory(
                    client,
                    stream,
                    opts.connection.startupDirectory ?? null,
                    () => settled
                  ),
                readShell: () => readLoginShell(client, () => settled),
                write: (line) => {
                  stream.write(`${line}\r`)
                }
              })
              if (settled) return
              if (startupNotice) session.notice(startupNotice)
              if (agentNotice) session.notice(agentNotice)
              session.setState('connected')
              settled = true
              resolveConnect()
            })()
          }
          const wantsForward = opts.connection.agentForward
          if (wantsForward && connectConfig.agent === undefined) agentNotice = AGENT_MISSING_NOTICE
          openShell(wantsForward && connectConfig.agent !== undefined)
        })
        .on('error', (err) => {
          if (settled) return
          settled = true
          const formatted = formatSshClientError(err)
          session.setState('error', formatted.message)
          rejectConnect(formatted)
        })
        .connect(connectConfig)
    })

    return session
  }
}

export { fingerprintHostKey, parseSshConnectionConfig } from './ssh-utils'
