import { stat } from 'node:fs/promises'
import { posix } from 'node:path'
import type {
  ConnectOptions,
  FileTransferCapability,
  ProtocolDriver,
  ProtocolSession,
  RemoteEntry,
  RemoteEntryType,
  SessionDataPort,
  SessionPortMessage,
  SessionState
} from '@shared/protocols'
import { Client, type FileInfo, FileType } from 'basic-ftp'

function toEntryType(info: FileInfo): RemoteEntryType {
  switch (info.type) {
    case FileType.Directory:
      return 'dir'
    case FileType.SymbolicLink:
      return 'link'
    case FileType.File:
      return 'file'
    default:
      return 'other'
  }
}

function toIsoDate(value: Date | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null
  return value.toISOString()
}

class FtpProtocolSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'file-transfer' as const
  readonly protocol = 'ftp'
  private _state: SessionState = 'connecting'
  private port: SessionDataPort | null = null
  private readonly client: Client
  private disposed = false
  private busy: Promise<unknown> = Promise.resolve()

  readonly fileTransfer: FileTransferCapability

  constructor(id: string, client: Client) {
    this.id = id
    this.client = client
    this.fileTransfer = {
      list: (path) => this.serialize(() => this.list(path)),
      mkdir: (path) => this.serialize(() => this.mkdir(path)),
      rename: (from, to) => this.serialize(() => this.rename(from, to)),
      remove: (path) => this.serialize(() => this.remove(path)),
      download: (remotePath, localPath, onProgress) =>
        this.serialize(() => this.download(remotePath, localPath, onProgress)),
      upload: (localPath, remotePath, onProgress) =>
        this.serialize(() => this.upload(localPath, remotePath, onProgress))
    }
  }

  get state(): SessionState {
    return this._state
  }

  setState(state: SessionState, errorMessage?: string | null): void {
    this._state = state
    this.post({ type: 'state', state, errorMessage: errorMessage ?? null })
  }

  attachPort(port: SessionDataPort): void {
    this.port = port
    port.start()
    this.post({ type: 'state', state: this._state })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this._state = 'closed'
    this.post({ type: 'state', state: 'closed' })
    try {
      this.client.close()
    } catch {
      // ignore
    }
    try {
      this.port?.close()
    } catch {
      // ignore
    }
    this.port = null
  }

  /**
   * basic-ftp's Client shares a single control connection so commands must be serialised.
   */
  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const next = this.busy.then(task, task)
    this.busy = next.catch(() => undefined)
    return next
  }

  private async list(path: string): Promise<RemoteEntry[]> {
    this.ensureAvailable()
    try {
      const entries = await this.client.list(path)
      return entries.map<RemoteEntry>((info) => ({
        name: info.name,
        path: posix.join(path, info.name),
        type: toEntryType(info),
        size: info.size,
        modifiedAt: toIsoDate(info.modifiedAt) ?? (info.rawModifiedAt || null)
      }))
    } catch (error) {
      throw new Error(`Falha ao listar diretório: ${errorMessage(error)}`)
    }
  }

  private async mkdir(path: string): Promise<void> {
    this.ensureAvailable()
    try {
      await this.client.ensureDir(path)
    } catch (error) {
      throw new Error(`Falha ao criar diretório: ${errorMessage(error)}`)
    }
  }

  private async rename(from: string, to: string): Promise<void> {
    this.ensureAvailable()
    try {
      await this.client.rename(from, to)
    } catch (error) {
      throw new Error(`Falha ao renomear: ${errorMessage(error)}`)
    }
  }

  private async remove(path: string): Promise<void> {
    this.ensureAvailable()
    try {
      await this.client.remove(path)
    } catch (fileError) {
      try {
        await this.client.removeDir(path)
      } catch (dirError) {
        throw new Error(
          `Falha ao remover caminho: ${errorMessage(fileError)}; ${errorMessage(dirError)}`
        )
      }
    }
  }

  private async download(
    remotePath: string,
    localPath: string,
    onProgress?: (bytesTransferred: number, totalBytes: number | null) => void
  ): Promise<void> {
    this.ensureAvailable()
    let totalBytes: number | null = null
    try {
      totalBytes = await this.client.size(remotePath)
    } catch {
      totalBytes = null
    }

    if (onProgress) {
      this.client.trackProgress((info) => {
        if (info.type === 'download') {
          onProgress(info.bytes, totalBytes)
        }
      })
    }
    try {
      await this.client.downloadTo(localPath, remotePath)
    } catch (error) {
      throw new Error(`Falha no download: ${errorMessage(error)}`)
    } finally {
      if (onProgress) this.client.trackProgress()
    }
  }

  private async upload(
    localPath: string,
    remotePath: string,
    onProgress?: (bytesTransferred: number, totalBytes: number | null) => void
  ): Promise<void> {
    this.ensureAvailable()
    let totalBytes: number | null = null
    try {
      const info = await stat(localPath)
      totalBytes = info.size
    } catch {
      totalBytes = null
    }

    if (onProgress) {
      this.client.trackProgress((info) => {
        if (info.type === 'upload') {
          onProgress(info.bytes, totalBytes)
        }
      })
    }
    try {
      await this.client.uploadFrom(localPath, remotePath)
    } catch (error) {
      throw new Error(`Falha no upload: ${errorMessage(error)}`)
    } finally {
      if (onProgress) this.client.trackProgress()
    }
  }

  private ensureAvailable(): void {
    if (this.disposed || this.client.closed) {
      throw new Error('Sessão FTP encerrada')
    }
  }

  private post(message: SessionPortMessage): void {
    try {
      this.port?.postMessage(message)
    } catch {
      // port may already be closed
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export class FtpDriver implements ProtocolDriver {
  readonly id = 'ftp'
  readonly protocols = ['ftp']
  readonly kind = 'file-transfer' as const

  async createSession(opts: ConnectOptions): Promise<ProtocolSession> {
    const { connection, sessionId, resolveSecret } = opts
    const host = connection.host.trim()
    if (!host) throw new Error('Host FTP obrigatório')
    if (!Number.isInteger(connection.port) || connection.port < 1 || connection.port > 65535) {
      throw new Error('Porta FTP inválida')
    }

    let password: string | undefined
    if (connection.authMethod === 'password') {
      if (!connection.credentialRef) {
        throw new Error('Senha não configurada para esta conexão')
      }
      password = await resolveSecret(connection.credentialRef)
    } else if (connection.authMethod !== 'none') {
      throw new Error(`Método de autenticação não suportado para FTP: ${connection.authMethod}`)
    }

    const user = connection.username?.trim() || 'anonymous'
    const client = new Client()
    const session = new FtpProtocolSession(sessionId, client)

    try {
      await client.access({
        host,
        port: connection.port,
        user,
        password: password ?? 'guest',
        secure: false
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao conectar ao servidor FTP'
      session.setState('error', message)
      try {
        client.close()
      } catch {
        // ignore
      }
      throw error instanceof Error ? error : new Error(message)
    }

    session.setState('connected')
    return session
  }
}
