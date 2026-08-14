import type { AuthMethod, Connection } from '../types'
import type { DatabaseIntrospection, DatabaseQueryResult, DatabaseTxState } from './database'
import type { FileTransferCapability } from './file-transfer'
import type { SessionKind, SessionState } from './session'

/** Resolve plaintext secrets for drivers — never exposed to the renderer. */
export type SecretResolver = (credentialRef: string) => string | Promise<string>

export type ConnectOptions = {
  connection: Connection
  sessionId: string
  resolveSecret: SecretResolver
  /**
   * Called when the remote host key must be verified.
   * Resolves to true if the user trusts the key.
   */
  verifyHostKey: (info: {
    host: string
    port: number
    keyType: string
    fingerprint: string
    hostKey: Uint8Array
  }) => Promise<boolean>
}

export type TerminalCapability = {
  write(data: Uint8Array): void
  resize(cols: number, rows: number): void
}

export type DatabaseCapability = {
  introspect(): Promise<DatabaseIntrospection>
  query(sql: string): Promise<DatabaseQueryResult>
  cancel(): Promise<void>
  getTxState(): DatabaseTxState
  setAutoCommit(on: boolean): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
}

/**
 * Minimal port surface shared by Electron MessagePortMain (main) and MessagePort (renderer).
 * Main attaches MessagePortMain; messages use structured clone.
 */
export type SessionDataPort = {
  postMessage(message: unknown): void
  close(): void
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  on(event: 'close', listener: () => void): void
  start(): void
}

export type ProtocolSession = {
  readonly id: string
  readonly kind: SessionKind
  readonly protocol: string
  readonly state: SessionState
  readonly terminal?: TerminalCapability
  readonly fileTransfer?: FileTransferCapability
  readonly database?: DatabaseCapability
  /**
   * Attach the main-side MessagePort. Outbound data/state go through this port;
   * inbound resize/data are handled by the driver.
   */
  attachPort(port: SessionDataPort): void
  dispose(): Promise<void>
}

export type ProtocolDriver = {
  readonly id: string
  readonly protocols: string[]
  readonly kind: SessionKind
  createSession(opts: ConnectOptions): Promise<ProtocolSession>
}

export type AuthConfig = {
  method: AuthMethod
  username: string | null
  credentialRef: string | null
  privateKeyPath: string | null
}
