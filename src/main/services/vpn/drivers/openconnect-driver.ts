import { createHash } from 'node:crypto'
import { connect as tlsConnect } from 'node:tls'
import { normalizeFortinetConfig } from '@shared/lib/vpn/host-port'
import { VpnError } from '../vpn-error'
import type { HelperRun } from '../vpn-helper'
import type { WindowsVpnService } from '../windows-vpn-service'
import type { VpnConnectContext, VpnDriver, VpnTunnelInfo } from './vpn-driver'

/** Pure parser for openconnect's log (FortiGate protocol). */
export type OpenconnectEvent =
  | { type: 'up'; ip: string }
  | { type: 'auth-failed' }
  | { type: 'cert-rejected' }
  | { type: 'unreachable'; message: string }
  | { type: 'other' }

export function parseOpenconnectLine(raw: string): OpenconnectEvent {
  const line = raw.trim()
  const up = /^(?:Connected as|Configured as) ([0-9.]+)/.exec(line)
  if (up) return { type: 'up', ip: up[1] }
  if (
    /Login failed|Failed to complete authentication|Authentication failed|Invalid credentials|permission denied/i.test(
      line
    )
  ) {
    return { type: 'auth-failed' }
  }
  if (
    // "Server certificate verify failed" alone is normal with a pin: openconnect checks the pin next
    /fingerprint\(s\) specified via --servercert match|certificate (hash|pin) (does not match|mismatch)/i.test(
      line
    )
  ) {
    return { type: 'cert-rejected' }
  }
  if (
    /Failed to connect to host|Failed to open HTTPS connection|getaddrinfo failed|Failed to connect to [0-9a-z.:-]+/i.test(
      line
    )
  ) {
    return { type: 'unreachable', message: line }
  }
  return { type: 'other' }
}

/**
 * digest: sha256 of the certificate (DER), the value the user trusts (openfortivpn's trusted-cert,
 * same on every OS). spki: sha256 of its public key, what openconnect's --servercert sha256: pins.
 */
export type GatewayCert = { digest: string; spki: string; trustedBySystem: boolean }

/** One DER element at `at`: where its content starts and where the element ends. */
function derElement(der: Buffer, at: number): { tag: number; body: number; end: number } {
  const tag = der[at]
  let len = der[at + 1]
  let body = at + 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + der[body + i]
    body += n
  }
  const end = body + len
  if (tag === undefined || end > der.length) throw new Error('certificado DER inválido')
  return { tag, body, end }
}

/**
 * The certificate's SubjectPublicKeyInfo, byte for byte as the gateway sent it (re-encoding the
 * key could change it, and openconnect hashes the original).
 */
function rawSpki(der: Buffer): Buffer {
  const tbs = derElement(der, derElement(der, 0).body)
  let at = tbs.body
  if (derElement(der, at).tag === 0xa0) at = derElement(der, at).end // [0] version
  // serial, signature algorithm, issuer, validity, subject, then the key
  for (let i = 0; i < 5; i++) at = derElement(der, at).end
  return der.subarray(at, derElement(der, at).end)
}

/** Both fingerprints of a DER certificate. */
export function certFingerprints(raw: Buffer): { digest: string; spki: string } {
  const spki = rawSpki(raw)
  return {
    digest: createHash('sha256').update(raw).digest('hex'),
    spki: createHash('sha256').update(spki).digest('hex')
  }
}

export function fetchGatewayCert(
  host: string,
  port: number,
  timeoutMs = 8000
): Promise<GatewayCert> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host, port, servername: host, rejectUnauthorized: false })
    const fail = (message: string) => {
      socket.destroy()
      reject(new VpnError('GATEWAY_UNREACHABLE', message))
    }
    socket.setTimeout(timeoutMs, () =>
      fail(`Nada respondeu em ${host}:${port}. Confira a porta e sua conexão com a internet.`)
    )
    socket.once('error', (error) =>
      fail(`Não foi possível alcançar ${host}:${port} (${error.message})`)
    )
    socket.once('secureConnect', () => {
      const raw = socket.getPeerCertificate().raw
      const trustedBySystem = socket.authorized
      socket.end()
      if (!raw) return fail(`${host}:${port} não apresentou certificado`)
      resolve({ ...certFingerprints(raw), trustedBySystem })
    })
  })
}

export type OpenconnectDriverDeps = {
  service: Pick<WindowsVpnService, 'ensure' | 'startForti'>
  gatewayCert?: (host: string, port: number) => Promise<GatewayCert>
  /** routes the tunnel installed, read from the OS (route print) */
  routes?: (localIp: string) => Promise<string[]>
  handshakeTimeoutMs?: number
  stopTimeoutMs?: number
}

/**
 * Windows FortiGate SSL-VPN: openconnect (--protocol=fortinet, Wintun) started by
 * north-vpn-service. Certificate trust works like openfortivpn on macOS/Linux: North reads
 * the gateway certificate itself and asks first; the service always gets it pinned.
 */
export class OpenconnectDriver implements VpnDriver {
  private run: HelperRun | null = null
  private connected = false
  private stopping = false
  private dropCallbacks: Array<(error?: Error) => void> = []

  constructor(private readonly deps: OpenconnectDriverDeps) {}

  onDrop(cb: (error?: Error) => void): void {
    this.dropCallbacks.push(cb)
  }

  async connect(ctx: VpnConnectContext): Promise<VpnTunnelInfo> {
    const { profile, secrets, log, signal } = ctx
    if (profile.config.kind !== 'fortinet-sslvpn') {
      throw new VpnError('INVALID_CONFIG', 'Perfil não é FortiGate SSL-VPN')
    }
    const config = normalizeFortinetConfig(profile.config)
    const password = secrets.get('password')
    if (!password) throw new VpnError('SECRET_MISSING', 'Senha da VPN não salva')

    const cert = await (this.deps.gatewayCert ?? fetchGatewayCert)(config.gateway, config.port)
    const pinned = config.trustedCert?.toLowerCase()
    if (pinned ? pinned !== cert.digest : !cert.trustedBySystem) {
      throw new VpnError(
        'CERT_UNTRUSTED',
        pinned
          ? 'O certificado do gateway MUDOU desde que você confiou nele. Só confie no novo se souber o motivo.'
          : 'O gateway usa um certificado que o sistema não reconhece. Confira a impressão digital antes de confiar.',
        undefined,
        cert.digest
      )
    }

    await this.deps.service.ensure()
    let resolveUp: (info: VpnTunnelInfo) => void = () => {}
    let rejectUp: (error: VpnError) => void = () => {}
    const up = new Promise<VpnTunnelInfo>((resolve, reject) => {
      resolveUp = resolve
      rejectUp = reject
    })
    let unreachable: string | undefined
    let lastLine = ''
    this.run = this.deps.service.startForti(
      {
        host: config.gateway,
        port: config.port,
        user: config.username,
        password,
        realm: config.realm,
        cert: cert.spki
      },
      (line) => {
        log(line)
        lastLine = line
        const event = parseOpenconnectLine(line)
        if (event.type === 'up') {
          this.connected = true
          void (this.deps.routes?.(event.ip) ?? Promise.resolve([])).then(
            (routes) => resolveUp({ localIp: event.ip, routes, redirectGateway: false }),
            () => resolveUp({ localIp: event.ip, routes: [], redirectGateway: false })
          )
        } else if (event.type === 'auth-failed') {
          rejectUp(new VpnError('AUTH_FAILED', 'Usuário ou senha recusados pelo FortiGate'))
        } else if (event.type === 'cert-rejected') {
          rejectUp(
            new VpnError(
              'CERT_UNTRUSTED',
              'O certificado do gateway mudou durante a conexão',
              undefined,
              cert.digest
            )
          )
        } else if (event.type === 'unreachable') {
          unreachable ??= event.message
        }
      }
    )
    void this.run.exited.then((result) => {
      if (!this.connected) {
        rejectUp(
          result.error ??
            (unreachable
              ? new VpnError(
                  'GATEWAY_UNREACHABLE',
                  `Não foi possível alcançar ${config.gateway}:${config.port} (${unreachable}).`
                )
              : new VpnError(
                  'DRIVER_CRASHED',
                  lastLine || `O openconnect encerrou (código ${result.code ?? '?'})`
                ))
        )
        return
      }
      if (this.stopping) return
      this.connected = false
      const callbacks = this.dropCallbacks
      this.dropCallbacks = []
      for (const cb of callbacks) cb(new VpnError('DRIVER_CRASHED', 'O túnel SSL-VPN caiu'))
    })

    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new VpnError('TIMEOUT', 'O FortiGate não respondeu a tempo')),
        this.deps.handshakeTimeoutMs ?? 30_000
      )
    })
    const aborted = new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new VpnError('TIMEOUT', 'Conexão cancelada')))
    })
    try {
      return await Promise.race([up, timeout, aborted])
    } catch (error) {
      await this.stop()
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async disconnect(): Promise<void> {
    await this.stop()
  }

  private async stop(): Promise<void> {
    this.stopping = true
    const run = this.run
    if (run) {
      run.stop()
      await Promise.race([
        run.exited,
        new Promise((r) => setTimeout(r, this.deps.stopTimeoutMs ?? 10_000))
      ])
    }
    this.run = null
    this.connected = false
  }
}
