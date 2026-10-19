import { randomBytes } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Socket, connect as tcpConnect } from 'node:net'
import { join } from 'node:path'
import { SECRET_INLINE_BLOCKS } from '@shared/lib/vpn/ovpn-parse'
import type { PrivilegeBroker } from '../privilege-broker'
import type { TunnelRegistry } from '../tunnel-registry'
import { VpnError } from '../vpn-error'
import type { HelperRun, VpnHelper } from '../vpn-helper'
import { helperRefusal } from './openvpn-helper-policy'
import {
  ManagementLineBuffer,
  parseManagementLine,
  parsePushReply,
  quoteManagementArg
} from './openvpn-management'
import type { VpnConnectContext, VpnDriver, VpnTunnelInfo } from './vpn-driver'

export type OpenVpnDriverDeps = {
  binary: () => string | null
  broker: PrivilegeBroker
  /** `userData/vpn/tmp` — temp configs (0600), wiped on disconnect and at boot. */
  tmpDir: string
  tunnels: TunnelRegistry
  handshakeTimeoutMs?: number
  managementConnectTimeoutMs?: number
  disconnectTimeoutMs?: number
  /** Root helper: no admin prompt per connection, for configs inside its whitelist. */
  helper?: Pick<VpnHelper, 'ensure' | 'startOpenvpn'>
}

const LOOPBACK = '127.0.0.1'

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, LOOPBACK, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Rebuild the runnable config: stored ovpn (no secret blocks) + inline blocks from the vault. */
function buildConfig(ovpn: string, inline: Record<string, string>): string {
  const blocks = SECRET_INLINE_BLOCKS.filter((tag) => inline[tag] !== undefined).map(
    (tag) => `<${tag}>\n${inline[tag]}\n</${tag}>`
  )
  return [ovpn.trimEnd(), ...blocks, ''].join('\n')
}

/**
 * OpenVPN via the management interface. Credentials only ever travel over the
 * localhost management socket; the process runs as root (via PrivilegeBroker), so
 * it's stopped with `signal SIGTERM` over management, never `kill`.
 */
export class OpenVpnDriver implements VpnDriver {
  private socket: Socket | null = null
  private files: string[] = []
  private profileId: string | null = null
  private pid: number | null = null
  private exited: Promise<unknown> | null = null
  private hasExited = false
  private connected = false
  private disconnecting = false
  private dropCallbacks: Array<(error?: Error) => void> = []
  private run: HelperRun | null = null

  constructor(private readonly deps: OpenVpnDriverDeps) {}

  onDrop(cb: (error?: Error) => void): void {
    this.dropCallbacks.push(cb)
  }

  async connect(ctx: VpnConnectContext): Promise<VpnTunnelInfo> {
    const { profile, secrets, log } = ctx
    if (profile.config.kind !== 'openvpn') {
      throw new VpnError('INVALID_CONFIG', 'Perfil não é OpenVPN')
    }
    const config = profile.config
    const binary = this.deps.binary()
    if (!binary) {
      throw new VpnError(
        'BINARY_MISSING',
        'OpenVPN não veio nesta instalação do North. Reinstale o North (em desenvolvimento: scripts/vpn-binaries/build.sh resources/vpn/bin).'
      )
    }

    const password = config.requiresUserPass ? secrets.get('password') : null
    const keyPassphrase = config.requiresKeyPassphrase ? secrets.get('key-passphrase') : null
    if (config.requiresUserPass && (!password || !config.username)) {
      throw new VpnError('SECRET_MISSING', 'Usuário ou senha da VPN não salvos')
    }
    if (config.requiresKeyPassphrase && !keyPassphrase) {
      throw new VpnError('SECRET_MISSING', 'Senha da chave privada não salva')
    }

    this.profileId = profile.id
    mkdirSync(this.deps.tmpDir, { recursive: true, mode: 0o700 })
    const token = randomBytes(8).toString('hex')
    const configPath = join(this.deps.tmpDir, `${profile.id}-${token}.ovpn`)
    const pwPath = join(this.deps.tmpDir, `${profile.id}-${token}.mgmt`)
    const mgmtPassword = randomBytes(24).toString('hex')
    const fullConfig = buildConfig(config.ovpn, secrets.inlineBlocks())
    const port = await freePort()

    let failWith: (error: VpnError) => void = () => {}
    const failure = new Promise<never>((_, reject) => {
      failWith = reject
    })
    failure.catch(() => {})

    // The helper runs whitelisted configs without a prompt; anything else (rare) keeps the
    // per-connection admin prompt rather than letting a root process run it unchecked.
    const refusal = this.deps.helper ? helperRefusal(fullConfig) : 'no helper'
    if (this.deps.helper && refusal) {
      log(`[north] "${refusal}" fora da lista do componente de VPN; pedindo senha de administrador`)
    }
    let exited: Promise<{ code: number | null; error?: VpnError }>
    if (this.deps.helper && !refusal) {
      await this.deps.helper.ensure({ openvpn: true })
      this.run = this.deps.helper.startOpenvpn(
        { port, managementPassword: mgmtPassword, ovpn: fullConfig },
        (chunk) => {
          for (const line of chunk.toString('utf8').split('\n')) if (line.trim()) log(line.trim())
        }
      )
      exited = this.run.exited
    } else {
      this.files = [configPath, pwPath]
      writeFileSync(configPath, fullConfig, { mode: 0o600 })
      writeFileSync(pwPath, `${mgmtPassword}\n`, { mode: 0o600 })
      const args = [
        '--config',
        configPath,
        '--management',
        LOOPBACK,
        String(port),
        pwPath,
        '--management-query-passwords',
        '--management-hold',
        '--auth-nocache',
        '--auth-retry',
        'none'
      ]
      exited = this.deps.broker.launch(binary, args).exited
    }
    this.exited = exited.then((result) => {
      this.hasExited = true
      this.onProcessExit()
      if (!this.connected) {
        failWith(
          result.error ??
            new VpnError(
              'DRIVER_CRASHED',
              `O OpenVPN encerrou inesperadamente (código ${result.code})`
            )
        )
      }
      return result
    })

    const handshakeMs = this.deps.handshakeTimeoutMs ?? 30_000
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new VpnError('TIMEOUT', 'O servidor VPN não respondeu a tempo')),
        handshakeMs
      )
    })
    const aborted = new Promise<never>((_, reject) => {
      ctx.signal.addEventListener('abort', () =>
        reject(new VpnError('TIMEOUT', 'Conexão cancelada'))
      )
    })

    try {
      const info = await Promise.race([
        this.handshake(
          port,
          mgmtPassword,
          pwPath,
          { password, keyPassphrase, username: config.username },
          log,
          failWith
        ),
        failure,
        timeout,
        aborted
      ])
      this.connected = true
      return info
    } catch (error) {
      await this.stop()
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true
    await this.stop()
  }

  private async handshake(
    port: number,
    mgmtPassword: string,
    pwPath: string,
    creds: { password: string | null; keyPassphrase: string | null; username?: string },
    log: (line: string) => void,
    fail: (error: VpnError) => void
  ): Promise<VpnTunnelInfo> {
    const socket = await this.connectManagement(port)
    this.socket = socket
    const send = (line: string) => {
      if (!socket.destroyed) socket.write(`${line}\n`)
    }
    const info: VpnTunnelInfo = { routes: [], redirectGateway: false }
    const buffer = new ManagementLineBuffer()

    return new Promise<VpnTunnelInfo>((resolve) => {
      socket.on('close', () => {
        if (!this.connected && !this.disconnecting) {
          fail(new VpnError('DRIVER_CRASHED', 'A interface de controle do OpenVPN foi fechada'))
        }
      })
      socket.on('data', (chunk) => {
        for (const line of buffer.push(chunk.toString('utf8'))) {
          const event = parseManagementLine(line)
          switch (event.type) {
            case 'password-prompt':
              send(mgmtPassword)
              rmSync(pwPath, { force: true })
              break
            case 'hold':
              send('state on')
              send('log on')
              send('pid')
              send('hold release')
              break
            case 'success': {
              const pid = /^pid=(\d+)/.exec(event.message)
              if (pid && this.profileId) {
                this.pid = Number(pid[1])
                this.deps.tunnels.write({
                  profileId: this.profileId,
                  pid: this.pid,
                  managementPort: port,
                  managementPassword: mgmtPassword
                })
              }
              break
            }
            case 'need-password':
              if (event.realm === 'Private Key') {
                if (!creds.keyPassphrase) {
                  fail(new VpnError('SECRET_MISSING', 'Senha da chave privada não salva'))
                  break
                }
                send(`password "Private Key" ${quoteManagementArg(creds.keyPassphrase)}`)
              } else {
                if (!creds.password || !creds.username) {
                  fail(new VpnError('SECRET_MISSING', 'Usuário ou senha da VPN não salvos'))
                  break
                }
                send(
                  `username ${quoteManagementArg(event.realm)} ${quoteManagementArg(creds.username)}`
                )
                send(
                  `password ${quoteManagementArg(event.realm)} ${quoteManagementArg(creds.password)}`
                )
              }
              break
            case 'verification-failed':
              fail(
                event.realm === 'Private Key'
                  ? new VpnError('KEY_PASSPHRASE_WRONG', 'Senha da chave privada incorreta')
                  : new VpnError('AUTH_FAILED', 'Senha recusada pelo servidor VPN')
              )
              break
            case 'fatal':
              log(`FATAL: ${event.message}`)
              fail(new VpnError('DRIVER_CRASHED', event.message))
              break
            case 'log': {
              log(event.message)
              const push = parsePushReply(event.message)
              if (push) {
                info.routes = push.routes
                info.redirectGateway = push.redirectGateway
                if (push.localIp) info.localIp = push.localIp
              }
              break
            }
            case 'state':
              log(`STATE ${event.state}${event.detail ? ` ${event.detail}` : ''}`)
              if (event.state === 'CONNECTED' && !this.connected) {
                if (event.localIp) info.localIp = event.localIp
                resolve(info)
              }
              break
          }
        }
      })
    })
  }

  private async connectManagement(port: number): Promise<Socket> {
    const deadline = Date.now() + (this.deps.managementConnectTimeoutMs ?? 60_000)
    while (Date.now() < deadline) {
      if (this.hasExited)
        throw new VpnError('DRIVER_CRASHED', 'O OpenVPN encerrou antes de iniciar')
      try {
        return await new Promise<Socket>((resolve, reject) => {
          const s = tcpConnect(port, LOOPBACK)
          s.once('connect', () => resolve(s))
          s.once('error', reject)
        })
      } catch {
        await sleep(100)
      }
    }
    throw new VpnError('TIMEOUT', 'O OpenVPN não abriu a interface de controle')
  }

  private onProcessExit(): void {
    const wasConnected = this.connected
    this.cleanupFiles()
    this.socket?.destroy()
    if (wasConnected && !this.disconnecting) {
      this.connected = false
      const callbacks = this.dropCallbacks
      this.dropCallbacks = []
      for (const cb of callbacks) cb(new VpnError('DRIVER_CRASHED', 'O túnel VPN caiu'))
    }
  }

  private async stop(): Promise<void> {
    this.disconnecting = true
    if (!this.hasExited && this.socket && !this.socket.destroyed) {
      this.socket.write('signal SIGTERM\n')
    }
    if (this.exited && !this.hasExited) {
      const timeoutMs = this.deps.disconnectTimeoutMs ?? 5000
      await Promise.race([this.exited, sleep(timeoutMs)])
      if (!this.hasExited) {
        if (this.run) this.run.stop()
        else if (this.pid) await this.deps.broker.kill(this.pid)
      }
    }
    this.socket?.destroy()
    this.cleanupFiles()
    this.connected = false
  }

  private cleanupFiles(): void {
    for (const file of this.files) rmSync(file, { force: true })
    this.files = []
    if (this.profileId) this.deps.tunnels.remove(this.profileId)
  }
}

/**
 * Boot-time cleanup after a crash: ask every recorded tunnel to stop over its
 * management port; if unreachable, fall back to an elevated kill by pid.
 */
export async function cleanupOpenvpnOrphans(deps: {
  tunnels: TunnelRegistry
  broker: PrivilegeBroker
  tmpDir: string
}): Promise<void> {
  for (const record of deps.tunnels.list()) {
    const stopped = await signalOverManagement(record.managementPort, record.managementPassword)
    if (!stopped && record.pid && isAlive(record.pid)) {
      await deps.broker.kill(record.pid).catch(() => {})
    }
    deps.tunnels.remove(record.profileId)
  }
  try {
    for (const name of readdirSync(deps.tmpDir)) rmSync(join(deps.tmpDir, name), { force: true })
  } catch {
    // no tmp dir yet
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM = exists but owned by root
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function signalOverManagement(port: number, password: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = tcpConnect(port, LOOPBACK)
    const done = (ok: boolean) => {
      clearTimeout(timer)
      socket.destroy()
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), 2000)
    const buffer = new ManagementLineBuffer()
    socket.once('error', () => done(false))
    socket.on('data', (chunk) => {
      for (const line of buffer.push(chunk.toString('utf8'))) {
        const event = parseManagementLine(line)
        if (event.type === 'password-prompt') socket.write(`${password}\n`)
        else if (event.type === 'success' && event.message.startsWith('password')) {
          socket.write('signal SIGTERM\n')
        } else if (event.type === 'success' && event.message.startsWith('signal')) done(true)
        else if (event.type === 'error') done(false)
      }
    })
  })
}
