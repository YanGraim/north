import type { Connection } from '@shared/types'
import { Client, type ClientChannel } from 'ssh2'
import { attachKeyboardInteractivePassword, buildSshConnectConfig } from '../../protocols/ssh-auth'

export type RemoteExecResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export type RemoteExecSession = {
  exec: (
    command: string,
    opts?: {
      timeoutMs?: number
      onStdout?: (chunk: string) => void
      onStderr?: (chunk: string) => void
    }
  ) => Promise<RemoteExecResult>
  dispose: () => Promise<void>
}

export type OpenRemoteExecOpts = {
  connection: Connection
  resolveSecret: (credentialRef: string) => Promise<string>
  /** Auto-accept host keys for non-interactive workflow runs (TOFU from known_hosts via verify). */
  verifyHostKey: (info: {
    host: string
    port: number
    keyType: string
    fingerprint: string
    hostKey: Uint8Array
  }) => Promise<boolean>
}

/**
 * One SSH TCP client per target per workflow run.
 * Each exec opens an independent channel — cwd does not persist between steps.
 */
export class RemoteExecService {
  async openSession(opts: OpenRemoteExecOpts): Promise<RemoteExecSession> {
    const client = new Client()
    const connectConfig = await buildSshConnectConfig({
      connection: opts.connection,
      sessionId: `remote-exec-${crypto.randomUUID()}`,
      resolveSecret: opts.resolveSecret,
      verifyHostKey: opts.verifyHostKey
    })

    if (opts.connection.authMethod === 'password' && connectConfig.password) {
      attachKeyboardInteractivePassword(client, connectConfig.password)
    }

    await new Promise<void>((resolve, reject) => {
      client.once('ready', () => resolve())
      client.once('error', (err) => reject(err))
      client.connect(connectConfig)
    })

    let disposed = false

    return {
      async exec(command, execOpts = {}) {
        if (disposed) {
          throw new Error('Remote exec session already disposed')
        }
        return execOnClient(client, command, execOpts)
      },
      async dispose() {
        if (disposed) return
        disposed = true
        client.end()
        client.destroy()
      }
    }
  }
}

function execOnClient(
  client: Client,
  command: string,
  opts: {
    timeoutMs?: number
    onStdout?: (chunk: string) => void
    onStderr?: (chunk: string) => void
  }
): Promise<RemoteExecResult> {
  return new Promise((resolve, reject) => {
    let settled = false
    let stdout = ''
    let stderr = ''
    let exitCode = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (err?: Error): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (err) {
        reject(err)
        return
      }
      resolve({ exitCode, stdout, stderr })
    }

    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        finish(new Error(`Command timed out after ${opts.timeoutMs}ms`))
      }, opts.timeoutMs)
    }

    client.exec(command, (err: Error | undefined, stream: ClientChannel) => {
      if (err) {
        finish(err)
        return
      }

      stream.on('data', (data: Buffer) => {
        const chunk = data.toString('utf8')
        stdout += chunk
        opts.onStdout?.(chunk)
      })
      stream.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString('utf8')
        stderr += chunk
        opts.onStderr?.(chunk)
      })
      stream.on('close', (code: number | null) => {
        exitCode = code ?? 0
        finish()
      })
      stream.on('error', (streamErr: Error) => finish(streamErr))
    })
  })
}

export const remoteExecService = new RemoteExecService()
