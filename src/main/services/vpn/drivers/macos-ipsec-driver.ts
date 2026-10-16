import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { VpnError } from '../vpn-error'
import { buildIpsecMobileconfig, northServiceName, parseNcList, parseNcStatus } from './macos-ipsec'
import type { VpnConnectContext, VpnDriver, VpnTunnelInfo } from './vpn-driver'

export type RunCommand = (
  cmd: string,
  args: string[]
) => Promise<{ code: number; stdout: string; stderr: string }>

export type MacosIpsecDriverDeps = {
  run: RunCommand
  /** `userData/vpn/tmp` — the .mobileconfig only lives here until macOS takes it. */
  tmpDir: string
  /** Which config (hash) is installed per profile, so we only re-prompt on change. */
  installedFile: string
  pollMs?: number
  approvalTimeoutMs?: number
  connectTimeoutMs?: number
  watchMs?: number
}

type Installed = Record<string, { fingerprint?: string; pending?: string }>

const SETTINGS_PROFILES_PANE =
  'x-apple.systempreferences:com.apple.preferences.configurationprofiles'
const APPROVAL_HINT =
  'Aprove o perfil "North" em Ajustes do Sistema → Geral → Gerenciamento de Dispositivos (ou Privacidade e Segurança → Perfis).'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * FortiGate IKEv1 (PSK + XAuth) through the macOS built-in IPSec client. The PSK
 * and XAuth password go into a .mobileconfig the user approves once (macOS keeps
 * them in the Keychain); connecting is then just `scutil --nc start <service>`.
 */
export class MacosIpsecDriver implements VpnDriver {
  private serviceId: string | null = null
  private watch: NodeJS.Timeout | null = null
  private dropCallbacks: Array<(error?: Error) => void> = []

  constructor(private readonly deps: MacosIpsecDriverDeps) {}

  onDrop(cb: (error?: Error) => void): void {
    this.dropCallbacks.push(cb)
  }

  async connect(ctx: VpnConnectContext): Promise<VpnTunnelInfo> {
    const { profile, secrets, log, progress, signal } = ctx
    if (profile.config.kind !== 'ipsec-ikev1') {
      throw new VpnError('INVALID_CONFIG', 'Perfil não é IPsec IKEv1')
    }
    const config = profile.config
    const psk = secrets.get('psk')
    const password = config.xauth === 'saved' ? secrets.get('password') : null
    if (!psk) throw new VpnError('SECRET_MISSING', 'Chave pré-compartilhada não salva')
    if (config.xauth === 'saved' && !password) {
      throw new VpnError('SECRET_MISSING', 'Senha do XAuth não salva')
    }

    const serviceName = northServiceName(profile.name)
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([profile.name, config, psk, password ?? '']))
      .digest('hex')
    const installed = this.readInstalled()
    const record = installed[profile.id] ?? {}
    let service = await this.findService(serviceName)

    if (service && record.pending === fingerprint) {
      installed[profile.id] = { fingerprint }
      this.writeInstalled(installed)
    } else if (service && record.fingerprint !== fingerprint) {
      log('Configuração mudou — reinstalando o perfil IPsec')
      const file = await this.openProfile(profile.id, {
        profileId: profile.id,
        name: profile.name,
        gateway: config.gateway,
        groupName: config.groupName,
        username: config.username,
        psk,
        xauthPassword: password ?? undefined
      })
      installed[profile.id] = { ...record, pending: fingerprint }
      this.writeInstalled(installed)
      setTimeout(() => rmSync(file, { force: true }), 30_000).unref?.()
      throw new VpnError(
        'PROFILE_APPROVAL_REQUIRED',
        `${APPROVAL_HINT} Depois clique em Conectar de novo.`
      )
    } else if (!service) {
      const file = await this.openProfile(profile.id, {
        profileId: profile.id,
        name: profile.name,
        gateway: config.gateway,
        groupName: config.groupName,
        username: config.username,
        psk,
        xauthPassword: password ?? undefined
      })
      progress?.(APPROVAL_HINT)
      try {
        service = await this.waitForService(serviceName, signal)
      } finally {
        rmSync(file, { force: true })
      }
      if (!service) {
        throw new VpnError(
          'PROFILE_APPROVAL_REQUIRED',
          `${APPROVAL_HINT} Depois clique em Conectar de novo.`
        )
      }
      installed[profile.id] = { fingerprint }
      this.writeInstalled(installed)
    }

    const id = service.id
    this.serviceId = id
    log(`scutil --nc start ${id}`)
    const started = await this.deps.run('scutil', ['--nc', 'start', id])
    if (started.code !== 0) {
      throw new VpnError(
        'CONNECTION_REJECTED',
        started.stderr.trim() || 'O macOS não iniciou a VPN'
      )
    }

    const deadline = Date.now() + (this.deps.connectTimeoutMs ?? 30_000)
    let seenConnecting = false
    let disconnectedPolls = 0
    while (Date.now() < deadline) {
      if (signal.aborted) {
        await this.stop()
        throw new VpnError('TIMEOUT', 'Conexão cancelada')
      }
      const status = parseNcStatus((await this.deps.run('scutil', ['--nc', 'status', id])).stdout)
      if (status.status === 'Connected') {
        log(`Conectado (${status.localIp ?? 'sem IP'})`)
        this.startWatch(id)
        return { localIp: status.localIp, routes: [], redirectGateway: false }
      }
      if (status.status === 'Connecting') seenConnecting = true
      if (status.status === 'Disconnected') {
        disconnectedPolls += 1
        if (seenConnecting || disconnectedPolls >= 3) {
          log(`Conexão recusada (LastCause ${status.lastCause ?? '?'})`)
          throw new VpnError(
            'CONNECTION_REJECTED',
            `O servidor VPN recusou a conexão (causa ${status.lastCause ?? 'desconhecida'}). Confira gateway, chave pré-compartilhada, grupo, usuário e senha.`
          )
        }
      }
      await sleep(this.deps.pollMs ?? 1000)
    }
    await this.stop()
    throw new VpnError('TIMEOUT', 'O servidor VPN não respondeu a tempo')
  }

  async disconnect(): Promise<void> {
    this.dropCallbacks = []
    await this.stop()
  }

  private async stop(): Promise<void> {
    if (this.watch) clearInterval(this.watch)
    this.watch = null
    if (this.serviceId) await this.deps.run('scutil', ['--nc', 'stop', this.serviceId])
  }

  private startWatch(id: string): void {
    this.watch = setInterval(async () => {
      const status = parseNcStatus((await this.deps.run('scutil', ['--nc', 'status', id])).stdout)
      if (status.status !== 'Disconnected' || !this.watch) return
      clearInterval(this.watch)
      this.watch = null
      const callbacks = this.dropCallbacks
      this.dropCallbacks = []
      for (const cb of callbacks) cb(new VpnError('DRIVER_CRASHED', 'O túnel IPsec caiu'))
    }, this.deps.watchMs ?? 5000)
    this.watch.unref?.()
  }

  private async findService(name: string) {
    const { stdout } = await this.deps.run('scutil', ['--nc', 'list'])
    return parseNcList(stdout).find((s) => s.name === name && s.type === 'IPSec') ?? null
  }

  private async waitForService(name: string, signal: AbortSignal) {
    const deadline = Date.now() + (this.deps.approvalTimeoutMs ?? 5 * 60_000)
    while (Date.now() < deadline && !signal.aborted) {
      const service = await this.findService(name)
      if (service) return service
      await sleep(this.deps.pollMs ?? 1000)
    }
    return null
  }

  private async openProfile(
    profileId: string,
    input: Parameters<typeof buildIpsecMobileconfig>[0]
  ): Promise<string> {
    mkdirSync(this.deps.tmpDir, { recursive: true, mode: 0o700 })
    const file = join(this.deps.tmpDir, `${profileId}.mobileconfig`)
    writeFileSync(file, buildIpsecMobileconfig(input), { mode: 0o600 })
    await this.deps.run('open', [file])
    await this.deps.run('open', [SETTINGS_PROFILES_PANE])
    return file
  }

  private readInstalled(): Installed {
    try {
      return JSON.parse(readFileSync(this.deps.installedFile, 'utf8')) as Installed
    } catch {
      return {}
    }
  }

  private writeInstalled(value: Installed): void {
    writeFileSync(this.deps.installedFile, JSON.stringify(value), { mode: 0o600 })
  }
}
