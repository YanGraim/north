import type {
  ConnectOptions,
  ProtocolDriver,
  ProtocolSession,
  SessionDataPort,
  SessionState
} from '@shared/protocols'
import { TcpBridge } from './tcp-bridge'

/**
 * RDP via TLS bridge + IronRDP WASM in the renderer.
 * Modern RDP servers expect TLS; certificate trust reuses the host-key prompt path (keyType `tls`).
 * Credential delivery is a one-shot MessagePort `desktop-auth` payload (documented exception).
 */
class RdpProtocolSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'desktop' as const
  readonly protocol = 'rdp'
  private disposed = false
  private pendingAuth: { username: string | null; password: string } | null

  constructor(
    id: string,
    private readonly bridge: TcpBridge,
    auth: { username: string | null; password: string } | null
  ) {
    this.id = id
    this.pendingAuth = auth
  }

  get state(): SessionState {
    return this.bridge.state
  }

  attachPort(port: SessionDataPort): void {
    this.bridge.attachPort(port)
    if (this.pendingAuth) {
      try {
        port.postMessage({
          type: 'desktop-auth',
          username: this.pendingAuth.username,
          password: this.pendingAuth.password
        })
      } finally {
        this.pendingAuth = null
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.pendingAuth = null
    await this.bridge.dispose()
  }
}

export class RdpDriver implements ProtocolDriver {
  readonly id = 'rdp'
  readonly protocols = ['rdp']
  readonly kind = 'desktop' as const

  async createSession(opts: ConnectOptions): Promise<ProtocolSession> {
    const { connection, sessionId, resolveSecret, verifyHostKey } = opts
    const bridge = new TcpBridge()

    let password = ''
    if (connection.credentialRef) {
      password = await resolveSecret(connection.credentialRef)
    } else if (connection.authMethod === 'password') {
      throw new Error('Senha não configurada para esta conexão RDP')
    }

    await bridge.connect({
      host: connection.host,
      port: connection.port,
      tls: true,
      onTlsCertificate: async ({ fingerprint, hostKey }) => {
        return verifyHostKey({
          host: connection.host,
          port: connection.port,
          keyType: 'tls',
          fingerprint,
          hostKey
        })
      }
    })

    return new RdpProtocolSession(sessionId, bridge, {
      username: connection.username,
      password
    })
  }
}
