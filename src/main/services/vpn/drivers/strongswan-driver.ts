import { VpnError } from '../vpn-error'
import type { HelperRun, VpnHelper } from '../vpn-helper'
import { buildIpsecHelperInput, parseStrongswanLine } from './strongswan-log'
import type { VpnConnectContext, VpnDriver, VpnTunnelInfo } from './vpn-driver'

export type StrongswanDriverDeps = {
  binary: () => string | null
  helper: Pick<VpnHelper, 'ensure' | 'startIpsec'>
  handshakeTimeoutMs?: number
  stopTimeoutMs?: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * FortiGate dial-up IPsec (IKEv1 aggressive, PSK + XAuth) on macOS/Linux through
 * strongSwan's charon-cmd, run by the root helper — no system profile to approve,
 * no admin prompt per connection, and FortiClient's proposals (DH 5) that the
 * built-in macOS client can't offer.
 */
export class StrongswanDriver implements VpnDriver {
  private run: HelperRun | null = null
  private connected = false
  private stopping = false
  private exited = false
  private dropCallbacks: Array<(error?: Error) => void> = []

  constructor(private readonly deps: StrongswanDriverDeps) {}

  onDrop(cb: (error?: Error) => void): void {
    this.dropCallbacks.push(cb)
  }

  async connect(ctx: VpnConnectContext): Promise<VpnTunnelInfo> {
    const { profile, secrets, log, signal } = ctx
    if (profile.config.kind !== 'ipsec-ikev1') {
      throw new VpnError('INVALID_CONFIG', 'Perfil não é IPsec IKEv1')
    }
    const config = profile.config
    if (!this.deps.binary()) {
      throw new VpnError(
        'BINARY_MISSING',
        'strongSwan não encontrado. Instale com "brew install strongswan" (macOS) ou o pacote strongswan / charon-cmd (Linux).'
      )
    }
    const psk = secrets.get('psk')
    if (!psk) throw new VpnError('SECRET_MISSING', 'Chave pré-compartilhada não salva')
    const password = secrets.get('password')
    if (!password) throw new VpnError('SECRET_MISSING', 'Senha da VPN não salva')

    let input: string
    try {
      input = buildIpsecHelperInput({
        gateway: config.gateway,
        username: config.username,
        groupName: config.groupName,
        psk,
        password
      })
    } catch (error) {
      throw new VpnError('INVALID_CONFIG', (error as Error).message)
    }

    await this.deps.helper.ensure({ ipsec: true })

    const lines: string[] = []
    let partial = ''
    const run = this.deps.helper.startIpsec(input, (chunk) => {
      const text = partial + chunk.toString('utf8')
      const parts = text.split('\n')
      partial = parts.pop() ?? ''
      lines.push(...parts.filter(Boolean))
    })
    this.run = run
    let exitCode: number | null | undefined
    let exitError: VpnError | undefined
    void run.exited.then((result) => {
      this.exited = true
      exitCode = result.code
      exitError = result.error
      this.onExit()
    })

    const deadline = Date.now() + (this.deps.handshakeTimeoutMs ?? 30_000)
    let localIp: string | undefined
    let lastError = ''
    let unreachable: string | undefined
    let answered = false
    try {
      while (true) {
        if (signal.aborted) throw new VpnError('TIMEOUT', 'Conexão cancelada')
        for (const line of lines.splice(0)) {
          log(line)
          if (/received packet/.test(line)) answered = true
          const event = parseStrongswanLine(line)
          if (event.type === 'address') localIp = event.ip
          else if (event.type === 'auth-failed') {
            throw new VpnError(
              'AUTH_FAILED',
              'O FortiGate recusou a chave pré-compartilhada ou o usuário/senha'
            )
          } else if (event.type === 'no-proposal') {
            throw new VpnError(
              'CONNECTION_REJECTED',
              'O FortiGate não aceitou a criptografia proposta (fase 1/2). Confira as propostas no FortiClient.'
            )
          } else if (event.type === 'unreachable') unreachable ??= event.message
          else if (event.type === 'error') lastError = event.message
          else if (event.type === 'up') {
            this.connected = true
            return { localIp, routes: [], redirectGateway: false }
          }
        }
        if (this.exited) {
          if (exitError?.code === 'PRIVILEGE_DENIED') throw exitError
          if (unreachable) {
            throw new VpnError(
              'GATEWAY_UNREACHABLE',
              `Não foi possível alcançar ${config.gateway} (${unreachable}). Confira o gateway e se a porta UDP 500/4500 está liberada.`
            )
          }
          throw new VpnError(
            'DRIVER_CRASHED',
            lastError || `O strongSwan encerrou (código ${exitCode ?? '?'})`
          )
        }
        if (Date.now() > deadline) {
          throw new VpnError(
            answered ? 'TIMEOUT' : 'GATEWAY_UNREACHABLE',
            answered
              ? 'O FortiGate não respondeu a tempo'
              : `O FortiGate não respondeu em ${config.gateway} (UDP 500/4500). Confira o gateway e se sua rede libera IPsec.`
          )
        }
        await sleep(100)
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
    const run = this.run
    if (run && !this.exited) {
      run.stop()
      await Promise.race([run.exited, sleep(this.deps.stopTimeoutMs ?? 10_000)])
    }
    this.connected = false
  }

  private onExit(): void {
    if (!this.connected || this.stopping) return
    this.connected = false
    const callbacks = this.dropCallbacks
    this.dropCallbacks = []
    for (const cb of callbacks) cb(new VpnError('DRIVER_CRASHED', 'O túnel IPsec caiu'))
  }
}
