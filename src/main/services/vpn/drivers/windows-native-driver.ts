import type { WindowsNativeVpnConfig, WindowsVpnProtocol } from '@shared/types'
import { VpnError } from '../vpn-error'
import type { VpnConnectContext, VpnDriver, VpnTunnelInfo } from './vpn-driver'

export type ProcessResult = { code: number; stdout: string; stderr: string }

/**
 * `powershell` gets its (secret-free) script via -EncodedCommand and the secrets on stdin;
 * `rasdial` only ever gets the entry name — credentials are saved in the phonebook first.
 */
export type WindowsNativeDriverDeps = {
  run(cmd: 'powershell' | 'rasdial', args: string[], stdin?: string): Promise<ProcessResult>
  routes(localIp: string): Promise<string[]>
  pollMs?: number
}

const TUNNEL_TYPE: Record<WindowsVpnProtocol, string> = {
  automatic: 'Automatic',
  pptp: 'Pptp',
  l2tp: 'L2tp',
  sstp: 'Sstp',
  ikev2: 'Ikev2'
}

/** The phonebook entry North owns for a profile (shown in Windows' VPN list too). */
export function windowsEntryName(profileName: string): string {
  const clean = profileName.replace(/[^\p{L}\p{N} ._()-]/gu, '').trim()
  return `North ${clean || 'VPN'}`.slice(0, 200)
}

const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`

const CIDR = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/

/** RasSetCredentials, so the user/password never sit on a command line. */
const SET_CREDENTIALS = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NorthRas {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct RASCREDENTIALS {
    public int dwSize; public int dwMask;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 257)] public string szUserName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 257)] public string szPassword;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 16)] public string szDomain;
  }
  [DllImport("rasapi32.dll", CharSet = CharSet.Unicode)]
  public static extern int RasSetCredentials(string pbk, string entry, ref RASCREDENTIALS c, bool clear);
  public static int Set(string pbk, string entry, string user, string pass) {
    var c = new RASCREDENTIALS();
    c.dwSize = Marshal.SizeOf(typeof(RASCREDENTIALS));
    c.dwMask = 0x3; c.szUserName = user; c.szPassword = pass; c.szDomain = "";
    return RasSetCredentials(pbk, entry, ref c, false);
  }
}
'@
`

/**
 * Creates (or refreshes) the user-scope phonebook entry and saves its credentials. No admin
 * needed. Pure, so the exact script is testable: it never contains a secret.
 */
export function buildEntryScript(entry: string, config: WindowsNativeVpnConfig): string {
  const routes = config.fullTunnel ? [] : (config.routes ?? []).filter((r) => CIDR.test(r.trim()))
  const params = [
    `Name = ${quote(entry)}`,
    `ServerAddress = ${quote(config.gateway.trim())}`,
    `TunnelType = ${quote(TUNNEL_TYPE[config.protocol])}`,
    `SplitTunneling = $${config.fullTunnel ? 'false' : 'true'}`,
    'RememberCredential = $true',
    'Force = $true'
  ]
  if (config.protocol === 'ikev2') params.push(`AuthenticationMethod = 'Eap'`)
  if (config.protocol === 'pptp' || config.protocol === 'sstp' || config.protocol === 'l2tp') {
    params.push(`AuthenticationMethod = 'MSChapv2'`)
  }
  return [
    "$ErrorActionPreference = 'Stop'",
    '$in = [Console]::In.ReadToEnd() | ConvertFrom-Json',
    `$name = ${quote(entry)}`,
    '$old = Get-VpnConnection -Name $name -ErrorAction SilentlyContinue',
    "if ($old -and $old.ConnectionStatus -eq 'Connected') { rasdial $name /disconnect | Out-Null }",
    'if ($old) { Remove-VpnConnection -Name $name -Force }',
    `$p = @{ ${params.join('; ')} }`,
    config.protocol === 'l2tp' ? '$p.L2tpPsk = $in.psk' : '',
    'Add-VpnConnection @p | Out-Null',
    ...routes.map(
      (r) =>
        `Add-VpnConnectionRoute -ConnectionName $name -DestinationPrefix ${quote(r.trim())} | Out-Null`
    ),
    SET_CREDENTIALS,
    '$pbk = Join-Path $env:APPDATA "Microsoft\\Network\\Connections\\Pbk\\rasphone.pbk"',
    '$r = [NorthRas]::Set($pbk, $name, [string]$in.username, [string]$in.password)',
    'if ($r -ne 0) { throw "RasSetCredentials falhou ($r)" }'
  ]
    .filter(Boolean)
    .join('\n')
}

const ipScript = (entry: string): string =>
  `(Get-NetIPAddress -InterfaceAlias ${quote(entry)} -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress`

export function powershellArgs(script: string): string[] {
  return [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64')
  ]
}

/** rasdial's exit code is the RAS error; its output also says "Remote Access error NNN". */
export function rasErrorCode(result: ProcessResult): number {
  const match = /error (\d{3,5})/i.exec(`${result.stdout}\n${result.stderr}`)
  return match ? Number(match[1]) : result.code
}

export function rasError(code: number, protocol: WindowsVpnProtocol): VpnError {
  if ([691, 718, 734, 917, 919, 13801].includes(code)) {
    return new VpnError('AUTH_FAILED', `Usuário ou senha recusados pelo servidor (erro ${code})`)
  }
  if (code === 789 || code === 13806) {
    return new VpnError(
      'AUTH_FAILED',
      protocol === 'l2tp'
        ? `Falha na negociação IPsec do L2TP — confira a chave pré-compartilhada (erro ${code})`
        : `Falha na negociação de segurança (erro ${code})`
    )
  }
  if ([800, 807, 809, 815, 868, 651, 678].includes(code)) {
    return new VpnError(
      'GATEWAY_UNREACHABLE',
      `Não foi possível falar com o servidor VPN (erro ${code}). Confira o endereço e o protocolo — redes que bloqueiam PPTP/L2TP também causam isso`
    )
  }
  if (code === 812 || code === 852 || code === 13868) {
    return new VpnError(
      'CONNECTION_REJECTED',
      `O servidor recusou a conexão pela política dele (erro ${code})`
    )
  }
  return new VpnError('CONNECTION_REJECTED', `O Windows não conectou a VPN (erro ${code})`)
}

/** Windows' built-in VPN client (PPTP, L2TP/IPsec, SSTP, IKEv2) through RAS. */
export class WindowsNativeDriver implements VpnDriver {
  private entry: string | null = null
  private poll: ReturnType<typeof setInterval> | null = null
  private stopping = false
  private dropCallbacks: Array<(error?: Error) => void> = []

  constructor(private readonly deps: WindowsNativeDriverDeps) {}

  onDrop(cb: (error?: Error) => void): void {
    this.dropCallbacks.push(cb)
  }

  async connect(ctx: VpnConnectContext): Promise<VpnTunnelInfo> {
    const config = ctx.profile.config
    if (config.kind !== 'windows-native') {
      throw new VpnError('INVALID_CONFIG', 'Perfil não é uma VPN do Windows')
    }
    const password = ctx.secrets.get('password')
    if (!password) throw new VpnError('SECRET_MISSING', 'Informe a senha da VPN')
    const psk = config.protocol === 'l2tp' ? ctx.secrets.get('psk') : null
    if (config.protocol === 'l2tp' && !psk) {
      throw new VpnError('SECRET_MISSING', 'Informe a chave pré-compartilhada (L2TP/IPsec)')
    }

    const entry = windowsEntryName(ctx.profile.name)
    this.entry = entry
    ctx.progress?.('Configurando a VPN no Windows…')
    const setup = await this.deps.run(
      'powershell',
      powershellArgs(buildEntryScript(entry, config)),
      JSON.stringify({ username: config.username, password, psk: psk ?? '' })
    )
    if (setup.code !== 0) {
      ctx.log(`[north] PowerShell: ${setup.stderr.trim() || setup.stdout.trim()}`)
      throw new VpnError(
        'DRIVER_CRASHED',
        'Não foi possível criar a VPN no Windows (veja o log da VPN)'
      )
    }
    ctx.log(`[north] entrada "${entry}" (${TUNNEL_TYPE[config.protocol]}) pronta`)
    if (ctx.signal.aborted) throw new VpnError('TIMEOUT', 'Conexão cancelada')

    ctx.progress?.('Discando…')
    const onAbort = (): void => void this.hangUp()
    ctx.signal.addEventListener('abort', onAbort, { once: true })
    let dial: ProcessResult
    try {
      dial = await this.deps.run('rasdial', [entry])
    } finally {
      ctx.signal.removeEventListener('abort', onAbort)
    }
    for (const line of dial.stdout.split(/\r?\n/)) if (line.trim()) ctx.log(line.trim())
    if (ctx.signal.aborted) throw new VpnError('TIMEOUT', 'Conexão cancelada')
    if (dial.code !== 0) throw rasError(rasErrorCode(dial), config.protocol)

    const ip = await this.deps.run('powershell', powershellArgs(ipScript(entry)))
    const localIp = ip.stdout.trim().split(/\s+/)[0] || undefined
    const routes = localIp ? await this.deps.routes(localIp) : []
    if (localIp) ctx.log(`[north] conectado como ${localIp}`)
    this.watch(entry)
    return { localIp, routes, redirectGateway: config.fullTunnel }
  }

  async disconnect(): Promise<void> {
    this.stopping = true
    await this.hangUp()
  }

  private async hangUp(): Promise<void> {
    if (this.poll) clearInterval(this.poll)
    this.poll = null
    if (this.entry) await this.deps.run('rasdial', [this.entry, '/disconnect'])
  }

  /** `rasdial` with no arguments lists the active connections. */
  private watch(entry: string): void {
    this.poll = setInterval(async () => {
      const active = await this.deps.run('rasdial', [])
      if (this.stopping || !this.poll) return
      const up = active.stdout.split(/\r?\n/).some((line) => line.trim() === entry)
      if (up) return
      clearInterval(this.poll)
      this.poll = null
      for (const cb of this.dropCallbacks) cb(new Error('A VPN do Windows caiu'))
    }, this.deps.pollMs ?? 5000)
  }
}
