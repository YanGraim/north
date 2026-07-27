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
import { Client, type ClientChannel } from 'ssh2'
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
          client.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => {
            if (settled) return
            if (err) {
              settled = true
              const formatted = formatSshClientError(err)
              session.setState('error', formatted.message)
              rejectConnect(formatted)
              return
            }
            session.attachStream(stream)
            session.setState('connected')
            settled = true
            resolveConnect()
          })
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
