import {
  type ConnectOptions,
  coerceBytes,
  type ProtocolDriver,
  type ProtocolSession,
  type SessionDataPort,
  type SessionPortMessage,
  type SessionState,
  type TerminalCapability
} from '@shared/protocols'
import { Client, type ClientChannel, type ShellOptions } from 'ssh2'
import { SessionPortOutlet } from './session-port-outlet'
import { attachKeyboardInteractivePassword, buildSshConnectConfig } from './ssh-auth'
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
            if (agentNotice) session.notice(agentNotice)
            session.setState('connected')
            settled = true
            resolveConnect()
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
