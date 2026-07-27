import { Socket } from 'node:net'
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
import { SessionPortOutlet } from './session-port-outlet'
import { buildNawsPayload, escapeTelnetData, TelnetParser } from './telnet-utils'

class TelnetProtocolSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'terminal' as const
  readonly protocol = 'telnet'
  private _state: SessionState = 'connecting'
  private port: SessionDataPort | null = null
  private readonly outlet = new SessionPortOutlet()
  private readonly socket: Socket
  private readonly parser = new TelnetParser()
  private disposed = false

  readonly terminal: TerminalCapability = {
    write: (data: Uint8Array): void => {
      if (this.socket.destroyed) return
      this.socket.write(Buffer.from(escapeTelnetData(data)))
    },
    resize: (cols: number, rows: number): void => {
      const payload = buildNawsPayload(cols, rows, this.parser.supportsNaws)
      if (payload.length > 0 && !this.socket.destroyed) {
        this.socket.write(Buffer.from(payload))
      }
    }
  }

  constructor(id: string, socket: Socket) {
    this.id = id
    this.socket = socket
  }

  get state(): SessionState {
    return this._state
  }

  setState(state: SessionState, errorMessage?: string | null): void {
    this._state = state
    this.post({ type: 'state', state, errorMessage: errorMessage ?? null })
  }

  attachSocket(): void {
    this.socket.on('data', (chunk: Buffer) => {
      const { data, response } = this.parser.process(Uint8Array.from(chunk))
      if (response.length > 0 && !this.socket.destroyed) {
        this.socket.write(Buffer.from(response))
      }
      if (data.length > 0) {
        this.post({ type: 'data', data })
      }
    })
    this.socket.on('close', () => {
      void this.dispose()
    })
    this.socket.on('error', (err) => {
      if (this._state !== 'connected') {
        this.setState('error', err.message)
      }
      void this.dispose()
    })
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

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this._state = 'closed'
    this.post({ type: 'state', state: 'closed' })
    try {
      this.socket.destroy()
    } catch {
      // ignore
    }
    try {
      this.port?.close()
    } catch {
      // ignore
    }
    this.port = null
    this.outlet.detach()
  }

  private post(message: SessionPortMessage): void {
    this.outlet.post(message)
  }
}

export class TelnetDriver implements ProtocolDriver {
  readonly id = 'telnet'
  readonly protocols = ['telnet']
  readonly kind = 'terminal' as const

  async createSession(opts: ConnectOptions): Promise<ProtocolSession> {
    const { connection, sessionId } = opts
    const host = connection.host.trim()
    if (!host) throw new Error('Host Telnet obrigatório')
    if (!Number.isInteger(connection.port) || connection.port < 1 || connection.port > 65535) {
      throw new Error('Porta Telnet inválida')
    }

    const socket = new Socket()
    socket.setNoDelay(true)
    const session = new TelnetProtocolSession(sessionId, socket)

    await new Promise<void>((resolveConnect, rejectConnect) => {
      let settled = false
      const onError = (err: Error): void => {
        if (settled) return
        settled = true
        session.setState('error', err.message)
        try {
          socket.destroy()
        } catch {
          // ignore
        }
        rejectConnect(err)
      }

      socket.once('error', onError)
      socket.connect(connection.port, host, () => {
        if (settled) return
        settled = true
        socket.off('error', onError)
        session.attachSocket()
        session.setState('connected')
        resolveConnect()
      })
    })

    return session
  }
}
