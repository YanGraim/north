import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrivilegeBroker } from '../privilege-broker'
import { VpnError } from '../vpn-error'
import { buildFortiConfig, parseFortiLine } from './openfortivpn-log'
import type { VpnConnectContext, VpnDriver, VpnTunnelInfo } from './vpn-driver'

export type OpenfortivpnDriverDeps = {
  binary: () => string | null
  broker: PrivilegeBroker
  tmpDir: string
  handshakeTimeoutMs?: number
  pollMs?: number
  stopTimeoutMs?: number
}

/**
 * Runs as root under the broker (one admin prompt). openfortivpn has no control
 * channel, so this wrapper lets North stop it later without a second prompt:
 * it exits (killing the tunnel) as soon as the user-owned stop file appears.
 * $1 binary, $2 config, $3 log, $4 stop file.
 */
const WRAPPER = [
  '"$1" -c "$2" >"$3" 2>&1 &',
  'pid=$!',
  'while kill -0 "$pid" 2>/dev/null; do',
  '  if [ -e "$4" ]; then kill -TERM "$pid"; wait "$pid"; exit 0; fi',
  '  sleep 1',
  'done',
  'wait "$pid"'
].join('\n')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** FortiGate SSL-VPN on macOS/Linux through openfortivpn (pppd under the hood). */
export class OpenfortivpnDriver implements VpnDriver {
  private files: { cfg: string; log: string; stop: string } | null = null
  private exited: Promise<unknown> | null = null
  private hasExited = false
  private connected = false
  private stopping = false
  private dropCallbacks: Array<(error?: Error) => void> = []

  constructor(private readonly deps: OpenfortivpnDriverDeps) {}

  onDrop(cb: (error?: Error) => void): void {
    this.dropCallbacks.push(cb)
  }

  async connect(ctx: VpnConnectContext): Promise<VpnTunnelInfo> {
    const { profile, secrets, log, signal } = ctx
    if (profile.config.kind !== 'fortinet-sslvpn') {
      throw new VpnError('INVALID_CONFIG', 'Perfil não é FortiGate SSL-VPN')
    }
    const config = profile.config
    const binary = this.deps.binary()
    if (!binary) {
      throw new VpnError(
        'BINARY_MISSING',
        'openfortivpn não encontrado. Instale com "brew install openfortivpn" (macOS) ou o pacote openfortivpn (Linux).'
      )
    }
    const password = secrets.get('password')
    if (!password) throw new VpnError('SECRET_MISSING', 'Senha da VPN não salva')

    mkdirSync(this.deps.tmpDir, { recursive: true, mode: 0o700 })
    const base = join(this.deps.tmpDir, `${profile.id}-${randomBytes(6).toString('hex')}.fvpn`)
    const files = { cfg: `${base}.cfg`, log: `${base}.log`, stop: `${base}.stop` }
    this.files = files
    writeFileSync(
      files.cfg,
      buildFortiConfig({
        gateway: config.gateway,
        port: config.port,
        username: config.username,
        password,
        realm: config.realm,
        trustedCert: config.trustedCert
      }),
      { mode: 0o600 }
    )
    writeFileSync(files.log, '', { mode: 0o600 })

    const proc = this.deps.broker.launch('/bin/sh', [
      '-c',
      WRAPPER,
      'north-vpn',
      binary,
      files.cfg,
      files.log,
      files.stop
    ])
    this.exited = proc.exited.then((result) => {
      this.hasExited = true
      this.onExit()
      return result
    })

    const deadline = Date.now() + (this.deps.handshakeTimeoutMs ?? 30_000)
    let offset = 0
    let localIp: string | undefined
    let certUntrusted = false
    let lastError = ''
    try {
      while (true) {
        if (signal.aborted) throw new VpnError('TIMEOUT', 'Conexão cancelada')
        const content = existsSync(files.log) ? readFileSync(files.log, 'utf8') : ''
        const fresh = content.slice(offset)
        const complete = fresh.lastIndexOf('\n') + 1
        offset += complete
        if (offset > 0 && existsSync(files.cfg)) rmSync(files.cfg, { force: true })
        for (const line of fresh.slice(0, complete).split('\n').filter(Boolean)) {
          log(line)
          const event = parseFortiLine(line)
          if (event.type === 'address') localIp = event.ip
          else if (event.type === 'cert-untrusted') certUntrusted = true
          else if (event.type === 'cert-digest' && certUntrusted) {
            throw new VpnError(
              'CERT_UNTRUSTED',
              config.trustedCert
                ? 'O certificado do gateway MUDOU desde que você confiou nele. Só confie no novo se souber o motivo.'
                : 'O gateway usa um certificado que o sistema não reconhece. Confira a impressão digital antes de confiar.',
              undefined,
              event.digest
            )
          } else if (event.type === 'auth-failed') {
            throw new VpnError('AUTH_FAILED', 'Usuário ou senha recusados pelo FortiGate')
          } else if (event.type === 'error') lastError = event.message
          else if (event.type === 'up') {
            rmSync(files.cfg, { force: true })
            this.connected = true
            return { localIp, routes: [], redirectGateway: false }
          }
        }
        if (this.hasExited) {
          const result = (await this.exited) as { error?: VpnError; code: number | null }
          throw (
            result.error ??
            new VpnError(
              'DRIVER_CRASHED',
              lastError || `O openfortivpn encerrou (código ${result.code})`
            )
          )
        }
        if (Date.now() > deadline)
          throw new VpnError('TIMEOUT', 'O FortiGate não respondeu a tempo')
        await sleep(this.deps.pollMs ?? 250)
      }
    } catch (error) {
      await this.stop()
      throw error
    }
  }

  async disconnect(): Promise<void> {
    await this.stop()
  }

  private async stop(): Promise<void> {
    this.stopping = true
    const files = this.files
    if (files && !this.hasExited) {
      writeFileSync(files.stop, '')
      await Promise.race([this.exited, sleep(this.deps.stopTimeoutMs ?? 10_000)])
    }
    this.cleanup()
    this.connected = false
  }

  private onExit(): void {
    const wasConnected = this.connected
    if (!wasConnected || this.stopping) return
    this.cleanup()
    this.connected = false
    const callbacks = this.dropCallbacks
    this.dropCallbacks = []
    for (const cb of callbacks) cb(new VpnError('DRIVER_CRASHED', 'O túnel SSL-VPN caiu'))
  }

  private cleanup(): void {
    if (!this.files) return
    for (const file of Object.values(this.files)) rmSync(file, { force: true })
  }
}

/** Boot: ask any wrapper left by a crashed North to stop (no prompt needed), then wipe its files. */
export async function cleanupFortiOrphans(tmpDir: string, waitMs = 3000): Promise<void> {
  let logs: string[]
  try {
    logs = readdirSync(tmpDir).filter((f) => f.endsWith('.fvpn.log'))
  } catch {
    return
  }
  for (const log of logs) writeFileSync(join(tmpDir, log.replace(/\.log$/, '.stop')), '')
  if (logs.length) await sleep(waitMs)
  for (const log of logs) {
    const base = join(tmpDir, log.replace(/\.log$/, ''))
    for (const ext of ['.cfg', '.log', '.stop']) rmSync(`${base}${ext}`, { force: true })
  }
}
