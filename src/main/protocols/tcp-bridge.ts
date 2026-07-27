import { createHash } from 'node:crypto'
import { createConnection, type Socket } from 'node:net'
import { type TLSSocket, connect as tlsConnect } from 'node:tls'
import {
  coerceBytes,
  type SessionDataPort,
  type SessionPortMessage,
  type SessionState
} from '@shared/protocols'
import { SessionPortOutlet } from './session-port-outlet'

export type TcpBridgeOptions = {
  host: string
  port: number
  tls?: boolean
  rejectUnauthorized?: boolean
  onTlsCertificate?: (info: {
    fingerprint: string
    pem: string
    hostKey: Uint8Array
  }) => Promise<boolean>
}

export class TcpBridge {
  private socket: Socket | TLSSocket | null = null
  private port: SessionDataPort | null = null
  private readonly outlet = new SessionPortOutlet()
  private _state: SessionState = 'connecting'
  private disposed = false

  get state(): SessionState {
    return this._state
  }

  async connect(opts: TcpBridgeOptions): Promise<void> {
    if (opts.tls) {
      await this.connectTls(opts)
    } else {
      await this.connectPlain(opts)
    }
  }

  attachPort(port: SessionDataPort): void {
    this.port = port
    port.on('message', (event) => {
      const message = event.data as SessionPortMessage
      if (!message || typeof message !== 'object') return
      if (message.type === 'data') {
        const bytes = coerceBytes(message.data)
        if (bytes) this.write(bytes)
      }
    })
    port.start()
    this.outlet.attach(port)
    this.post({ type: 'state', state: this._state })
  }

  write(data: Uint8Array): void {
    this.socket?.write(Buffer.from(data))
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this._state = 'closed'
    this.post({ type: 'state', state: 'closed' })
    this.socket?.destroy()
    this.socket = null
    try {
      this.port?.close()
    } catch {
      // ignore
    }
    this.port = null
    this.outlet.detach()
  }

  private async connectPlain(opts: TcpBridgeOptions): Promise<void> {
    const socket = createConnection({ host: opts.host, port: opts.port })
    this.socket = socket
    this.bindSocket(socket)

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => {
        this._state = 'connected'
        resolve()
      })
      socket.once('error', reject)
    })
  }

  private async connectTls(opts: TcpBridgeOptions): Promise<void> {
    const socket = tlsConnect({
      host: opts.host,
      port: opts.port,
      rejectUnauthorized: false,
      servername: opts.host
    })
    this.socket = socket

    await new Promise<void>((resolve, reject) => {
      socket.once('secureConnect', () => {
        void (async () => {
          try {
            const cert = socket.getPeerCertificate()
            const raw = cert.raw as Buffer | undefined
            if (raw && opts.onTlsCertificate) {
              const fingerprint = `SHA256:${createHash('sha256').update(raw).digest('base64').replace(/=+$/, '')}`
              const pem = `-----BEGIN CERTIFICATE-----\n${raw.toString('base64')}\n-----END CERTIFICATE-----`
              const accepted = await opts.onTlsCertificate({
                fingerprint,
                pem,
                hostKey: new Uint8Array(raw)
              })
              if (!accepted) {
                socket.destroy()
                reject(new Error('Certificado TLS rejeitado'))
                return
              }
            }
            this._state = 'connected'
            this.bindSocket(socket)
            resolve()
          } catch (error) {
            reject(error)
          }
        })()
      })
      socket.once('error', reject)
    })
  }

  private bindSocket(socket: Socket | TLSSocket): void {
    socket.on('data', (chunk: Buffer) => {
      this.post({ type: 'data', data: Uint8Array.from(chunk) })
    })
    socket.on('close', () => {
      void this.dispose()
    })
    socket.on('error', (err) => {
      this._state = 'error'
      this.post({ type: 'error', message: err.message })
      this.post({ type: 'state', state: 'error', errorMessage: err.message })
    })
  }

  private post(message: SessionPortMessage): void {
    this.outlet.post(message)
  }
}
