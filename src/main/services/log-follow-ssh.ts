import type { Connection } from '@shared/types'
import { Client, type ClientChannel } from 'ssh2'
import { attachKeyboardInteractivePassword, buildSshConnectConfig } from '../protocols/ssh-auth'

export type HostKeyInfo = {
  host: string
  port: number
  keyType: string
  fingerprint: string
  hostKey: Uint8Array
}

export type FollowExec = {
  onStdout(listener: (chunk: Uint8Array) => void): void
  onStderr(listener: (chunk: Uint8Array) => void): void
  onExit(listener: (code: number | null) => void): void
  close(): void
}

export type FollowClient = {
  homeDirectory(): Promise<string | null>
  exec(command: string): Promise<FollowExec>
  onDisconnect(listener: (error: unknown) => void): void
  end(): void
}

export type FollowConnector = {
  open(opts: {
    connection: Connection
    resolveSecret: (credentialRef: string) => Promise<string>
    verifyHostKey: (info: HostKeyInfo) => Promise<boolean>
  }): Promise<FollowClient>
}

function asBytes(data: Buffer | string): Uint8Array {
  return typeof data === 'string' ? Buffer.from(data) : data
}

/**
 * `tail` block-buffers stdout when it is not a terminal, so live lines never
 * show up. A pty makes it line-buffered. Stdin is never written.
 */
export const TAIL_EXEC_OPTIONS = {
  pty: { rows: 24, cols: 220, term: 'xterm-256color' }
} as const

class SshFollowClient implements FollowClient {
  private ended = false

  constructor(private readonly client: Client) {}

  homeDirectory(): Promise<string | null> {
    return new Promise((resolve) => {
      this.client.sftp((error, sftp) => {
        if (error || !sftp) {
          resolve(null)
          return
        }
        sftp.realpath('.', (realError, abs) => {
          sftp.end()
          resolve(realError || !abs ? null : abs)
        })
      })
    })
  }

  exec(command: string): Promise<FollowExec> {
    return new Promise((resolve, reject) => {
      this.client.exec(
        command,
        TAIL_EXEC_OPTIONS,
        (error: Error | undefined, stream: ClientChannel) => {
          if (error || !stream) {
            reject(error ?? new Error('exec failed'))
            return
          }
          resolve({
            onStdout(listener) {
              stream.on('data', (data: Buffer | string) => listener(asBytes(data)))
            },
            onStderr(listener) {
              stream.stderr.on('data', (data: Buffer | string) => listener(asBytes(data)))
            },
            onExit(listener) {
              stream.on('close', (code: number | null) => listener(code))
            },
            close() {
              stream.close()
            }
          })
        }
      )
    })
  }

  onDisconnect(listener: (error: unknown) => void): void {
    let noted = false
    const note = (error: unknown): void => {
      if (this.ended || noted) return
      noted = true
      listener(error)
    }
    this.client.on('error', note)
    this.client.on('close', () => note(new Error('ssh closed')))
  }

  end(): void {
    this.ended = true
    this.client.end()
    this.client.destroy()
  }
}

export const sshFollowConnector: FollowConnector = {
  async open(opts) {
    const connectConfig = await buildSshConnectConfig({
      connection: opts.connection,
      sessionId: `log-follow-${crypto.randomUUID()}`,
      resolveSecret: opts.resolveSecret,
      verifyHostKey: opts.verifyHostKey
    })
    const client = new Client()
    if (typeof connectConfig.password === 'string') {
      attachKeyboardInteractivePassword(client, connectConfig.password)
    }
    await new Promise<void>((resolve, reject) => {
      client.once('ready', () => resolve())
      client.once('error', (error: Error) => reject(error))
      client.connect(connectConfig)
    })
    return new SshFollowClient(client)
  }
}
