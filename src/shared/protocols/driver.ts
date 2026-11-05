import type { ListDirectoryResult } from '../lib/list-directory'
import type { PathStatResult } from '../lib/selection-path'
import type {
  ChangeDirectoryResult,
  SessionHomeResult,
  SessionMutateResult
} from '../lib/session-shell'
import type { AuthMethod, Connection } from '../types'
import type { ApiSendInput, ApiSendResult } from './api'
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

export type DatabaseQueryOptions = {
  maxRows: number
  timeoutMs: number
}

export type DatabaseCapability = {
  introspect(): Promise<DatabaseIntrospection>
  query(sql: string, options?: DatabaseQueryOptions): Promise<DatabaseQueryResult>
  cancel(): Promise<void>
  getTxState(): DatabaseTxState
  setAutoCommit(on: boolean): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
}

export type ApiCapability = {
  send(input: ApiSendInput): Promise<ApiSendResult>
  cancel(requestId: string): void
}

/**
 * Classify a path on the SSH client that already owns the terminal.
 * Only the SSH session implements this. Other protocols leave it unset.
 */
export type PathStatCapability = {
  classifyPath(path: string): Promise<PathStatResult>
}

/**
 * List one directory on the SSH client that already owns the terminal.
 * Only that SSH session implements this. The result never includes an ssh2 message.
 */
export type DirectoryListCapability = {
  list(path: string): Promise<ListDirectoryResult>
}

/**
 * File actions on the SSH client that already owns the terminal.
 * `changeDirectory` may write a quoted `cd`; the other calls stay on SFTP.
 */
export type TerminalShellCapability = {
  home(): SessionHomeResult
  changeDirectory(path: string): ChangeDirectoryResult
  cancelDirectoryChange(): void
  mkdir(path: string): Promise<SessionMutateResult>
  rename(from: string, to: string): Promise<SessionMutateResult>
  remove(path: string): Promise<SessionMutateResult>
  currentDirectory(): string | null
  openFileTransfer(): Promise<
    | { ok: true; transfer: FileTransferCapability; close: () => void }
    | { ok: false; reason: 'unavailable' }
  >
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
  /** OS pid of the underlying local process (shell/pty) — set only by local-shell sessions. */
  readonly pid?: number
  readonly terminal?: TerminalCapability
  /** Present only on an SSH terminal session. */
  readonly pathStat?: PathStatCapability
  /** Present only on an SSH terminal session. Lists via a short-lived SFTP channel. */
  readonly listDirectory?: DirectoryListCapability
  /** Present only on an SSH terminal session. Navigation and file actions for the cwd panel. */
  readonly terminalShell?: TerminalShellCapability
  readonly fileTransfer?: FileTransferCapability
  readonly database?: DatabaseCapability
  readonly api?: ApiCapability
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
