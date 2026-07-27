import type {
  ConnectOptions,
  ProtocolDriver,
  ProtocolSession,
  SessionDataPort,
  SessionState
} from '@shared/protocols'
import { TcpBridge } from './tcp-bridge'

class VncProtocolSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'desktop' as const
  readonly protocol = 'vnc'
  private disposed = false
  private pendingPassword: string | null

  constructor(
    id: string,
    private readonly bridge: TcpBridge,
    password: string | null
  ) {
    this.id = id
    this.pendingPassword = password
  }

  get state(): SessionState {
    return this.bridge.state
  }

  attachPort(port: SessionDataPort): void {
    this.bridge.attachPort(port)
    // Documented exception: one-time secret via MessagePort handshake only (never window.north).
    if (this.pendingPassword) {
      try {
        port.postMessage({
          type: 'desktop-auth',
          password: this.pendingPassword
        })
      } finally {
        this.pendingPassword = null
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.pendingPassword = null
    await this.bridge.dispose()
  }
}

export class VncDriver implements ProtocolDriver {
  readonly id = 'vnc'
  readonly protocols = ['vnc']
  readonly kind = 'desktop' as const

  async createSession(opts: ConnectOptions): Promise<ProtocolSession> {
    const { connection, sessionId, resolveSecret } = opts
    const bridge = new TcpBridge()
    let password: string | null = null
    if (connection.credentialRef) {
      password = await resolveSecret(connection.credentialRef)
    }

    await bridge.connect({
      host: connection.host,
      port: connection.port,
      tls: false
    })

    return new VncProtocolSession(sessionId, bridge, password)
  }
}
