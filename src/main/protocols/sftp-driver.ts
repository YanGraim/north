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
import { Client, type SFTPWrapper, type Stats } from 'ssh2'
import { buildSshConnectConfig } from './ssh-auth'

function toEntryType(stats: Stats): RemoteEntryType {
  if (stats.isDirectory()) return 'dir'
  if (stats.isSymbolicLink()) return 'link'
  if (stats.isFile()) return 'file'
  return 'other'
}

function normalizeMtime(mtime: number | undefined | null): string | null {
  if (typeof mtime !== 'number' || !Number.isFinite(mtime) || mtime <= 0) return null
  return new Date(mtime * 1000).toISOString()
}

class SftpProtocolSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'file-transfer' as const
  readonly protocol = 'sftp'
  private _state: SessionState = 'connecting'
  private port: SessionDataPort | null = null
  private readonly client: Client
  private sftp: SFTPWrapper | null = null
  private disposed = false

  readonly fileTransfer: FileTransferCapability

  constructor(id: string, client: Client) {
    this.id = id
    this.client = client
    this.fileTransfer = {
      list: (path) => this.list(path),
      mkdir: (path) => this.mkdir(path),
      rename: (from, to) => this.rename(from, to),
      remove: (path) => this.remove(path),
      download: (remotePath, localPath, onProgress) =>
        this.download(remotePath, localPath, onProgress),
      upload: (localPath, remotePath, onProgress) => this.upload(localPath, remotePath, onProgress)
    }
  }

  get state(): SessionState {
    return this._state
  }

  setState(state: SessionState, errorMessage?: string | null): void {
    this._state = state
    this.post({ type: 'state', state, errorMessage: errorMessage ?? null })
  }

  attachSftp(sftp: SFTPWrapper): void {
    this.sftp = sftp
    sftp.on('close', () => {
      void this.dispose()
    })
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
      this.sftp?.end()
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
    this.sftp = null
    this.port = null
  }

  private requireSftp(): SFTPWrapper {
    if (!this.sftp) {
      throw new Error('Sessão SFTP não está pronta')
    }
    return this.sftp
  }

  private list(path: string): Promise<RemoteEntry[]> {
    const sftp = this.requireSftp()
    return new Promise((resolve, reject) => {
      sftp.readdir(path, (err, entries) => {
        if (err) {
          reject(new Error(`Falha ao listar diretório: ${err.message}`))
          return
        }
        const mapped = entries.map<RemoteEntry>((entry) => ({
          name: entry.filename,
          path: posix.join(path, entry.filename),
          type: toEntryType(entry.attrs),
          size: entry.attrs.size ?? 0,
          modifiedAt: normalizeMtime(entry.attrs.mtime)
        }))
        resolve(mapped)
      })
    })
  }

  private mkdir(path: string): Promise<void> {
    const sftp = this.requireSftp()
    return new Promise((resolve, reject) => {
      sftp.mkdir(path, (err) => {
        if (err) reject(new Error(`Falha ao criar diretório: ${err.message}`))
        else resolve()
      })
    })
  }

  private rename(from: string, to: string): Promise<void> {
    const sftp = this.requireSftp()
    return new Promise((resolve, reject) => {
      sftp.rename(from, to, (err) => {
        if (err) reject(new Error(`Falha ao renomear: ${err.message}`))
        else resolve()
      })
    })
  }

  private async remove(path: string): Promise<void> {
    const sftp = this.requireSftp()
    const stats = await new Promise<Stats>((resolve, reject) => {
      sftp.stat(path, (err, s) => {
        if (err) reject(new Error(`Falha ao consultar caminho: ${err.message}`))
        else resolve(s)
      })
    })

    if (stats.isDirectory()) {
      await new Promise<void>((resolve, reject) => {
        sftp.rmdir(path, (err) => {
          if (err) reject(new Error(`Falha ao remover diretório: ${err.message}`))
          else resolve()
        })
      })
      return
    }

    await new Promise<void>((resolve, reject) => {
      sftp.unlink(path, (err) => {
        if (err) reject(new Error(`Falha ao remover arquivo: ${err.message}`))
        else resolve()
      })
    })
  }

  private download(
    remotePath: string,
    localPath: string,
    onProgress?: (bytesTransferred: number, totalBytes: number | null) => void
  ): Promise<void> {
    const sftp = this.requireSftp()
    return new Promise((resolve, reject) => {
      sftp.fastGet(
        remotePath,
        localPath,
        {
          step: (total, _nb, fsize) => {
            onProgress?.(total, fsize && fsize > 0 ? fsize : null)
          }
        },
        (err) => {
          if (err) reject(new Error(`Falha no download: ${err.message}`))
          else resolve()
        }
      )
    })
  }

  private upload(
    localPath: string,
    remotePath: string,
    onProgress?: (bytesTransferred: number, totalBytes: number | null) => void
  ): Promise<void> {
    const sftp = this.requireSftp()
    return new Promise((resolve, reject) => {
      sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (total, _nb, fsize) => {
            onProgress?.(total, fsize && fsize > 0 ? fsize : null)
          }
        },
        (err) => {
          if (err) reject(new Error(`Falha no upload: ${err.message}`))
          else resolve()
        }
      )
    })
  }

  private post(message: SessionPortMessage): void {
    try {
      this.port?.postMessage(message)
    } catch {
      // port may already be closed
    }
  }
}

export class SftpDriver implements ProtocolDriver {
  readonly id = 'sftp'
  readonly protocols = ['sftp']
  readonly kind = 'file-transfer' as const

  async createSession(opts: ConnectOptions): Promise<ProtocolSession> {
    const { sessionId } = opts
    const connectConfig = await buildSshConnectConfig(opts)

    const client = new Client()
    const session = new SftpProtocolSession(sessionId, client)

    await new Promise<void>((resolveConnect, rejectConnect) => {
      let settled = false
      client
        .on('ready', () => {
          client.sftp((err, sftp) => {
            if (settled) return
            if (err) {
              settled = true
              session.setState('error', err.message)
              rejectConnect(err)
              return
            }
            session.attachSftp(sftp)
            session.setState('connected')
            settled = true
            resolveConnect()
          })
        })
        .on('error', (err) => {
          if (settled) return
          settled = true
          session.setState('error', err.message)
          rejectConnect(err)
        })
        .connect(connectConfig)
    })

    return session
  }
}
