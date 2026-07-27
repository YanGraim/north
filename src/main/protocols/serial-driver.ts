import type { EventEmitter } from 'node:events'
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
import { SerialPort } from 'serialport'
import { SessionPortOutlet } from './session-port-outlet'

/**
 * Structural interface consumed by the driver so tests can substitute a fake
 * transport without a real device.
 */
export interface SerialTransport extends EventEmitter {
  readonly isOpen: boolean
  open(cb: (err: Error | null) => void): void
  close(cb?: (err: Error | null) => void): void
  write(data: Buffer, cb?: (err: Error | null | undefined) => void): boolean
}

export type SerialTransportFactory = (config: { path: string; baudRate: number }) => SerialTransport

const defaultFactory: SerialTransportFactory = ({ path, baudRate }) =>
  new SerialPort({ path, baudRate, autoOpen: false }) as unknown as SerialTransport

class SerialProtocolSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'terminal' as const
  readonly protocol = 'serial'
  private _state: SessionState = 'connecting'
  private port: SessionDataPort | null = null
  private readonly outlet = new SessionPortOutlet()
  private readonly transport: SerialTransport
  private disposed = false

  readonly terminal: TerminalCapability = {
    write: (data: Uint8Array): void => {
      if (!this.transport.isOpen) return
      this.transport.write(Buffer.from(data))
    },
    resize: (_cols: number, _rows: number): void => {
      // Serial devices are unaware of window size.
    }
  }

  constructor(id: string, transport: SerialTransport) {
    this.id = id
    this.transport = transport
  }

  get state(): SessionState {
    return this._state
  }

  setState(state: SessionState, errorMessage?: string | null): void {
    this._state = state
    this.post({ type: 'state', state, errorMessage: errorMessage ?? null })
  }

  attachTransport(): void {
    this.transport.on('data', (chunk: Buffer) => {
      this.post({ type: 'data', data: Uint8Array.from(chunk) })
    })
    this.transport.on('close', () => {
      void this.dispose()
    })
    this.transport.on('error', (err: Error) => {
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
      if (this.transport.isOpen) {
        this.transport.close()
      }
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

export class SerialDriver implements ProtocolDriver {
  readonly id = 'serial'
  readonly protocols = ['serial']
  readonly kind = 'terminal' as const

  constructor(private readonly factory: SerialTransportFactory = defaultFactory) {}

  async createSession(opts: ConnectOptions): Promise<ProtocolSession> {
    const { connection, sessionId } = opts
    const path = connection.host.trim()
    if (!path) throw new Error('Caminho do dispositivo serial obrigatório')

    const baudRate = connection.port
    if (!Number.isInteger(baudRate) || baudRate <= 0) {
      throw new Error('Baud rate inválido')
    }

    const transport = this.factory({ path, baudRate })
    const session = new SerialProtocolSession(sessionId, transport)

    await new Promise<void>((resolveOpen, rejectOpen) => {
      transport.open((err) => {
        if (err) {
          session.setState('error', err.message)
          rejectOpen(err)
          return
        }
        session.attachTransport()
        session.setState('connected')
        resolveOpen()
      })
    })

    return session
  }
}
