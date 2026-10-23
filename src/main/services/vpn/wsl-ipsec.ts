import { spawn } from 'node:child_process'
import type { LaunchResult } from './privilege-broker'
import { VpnError } from './vpn-error'
import type { HelperRun } from './vpn-helper'

/**
 * IPsec IKEv1 (FortiGate dial-up) on Windows: no Windows IKE client can do PSK + XAuth with
 * a pushed address, so North runs the same strongSwan + helper as on macOS/Linux inside its
 * own small WSL2 distro ("NorthVpn", imported from the bundled north-wsl.tar.gz, no admin
 * needed). Windows reaches the VPN's networks through routes to the WSL VM, held by
 * north-vpn-service; the distro forwards and NATs them into the tunnel. The VM only runs
 * while the tunnel is up (`wsl --terminate` on disconnect frees its memory).
 */
export const WSL_DISTRO = 'NorthVpn'
const HELPER = '/opt/north/north-vpn-helper'

export type WslRun = (args: string[]) => Promise<{ code: number | null; stdout: string }>

export type WslIpsecDeps = {
  /** bundled north-wsl.tar.gz, or null when not packaged */
  tarball: () => string | null
  digest: (path: string) => string | null
  /** where the distro's disk lives (userData/vpn/wsl) and the digest of what was imported */
  installDir: string
  /** creates installDir (and its parents): wsl --import won't, and fails with PATH_NOT_FOUND */
  mkdir: (dir: string) => void
  imported: { read: () => string | null; write: (digest: string) => void; clear: () => void }
  /** runs wsl.exe with these args (no shell) */
  wsl: WslRun
  /** spawns wsl.exe streaming stdout+stderr, stdin = input */
  spawn?: (args: string[], input: string, onOutput: (chunk: Buffer) => void) => HelperRun
  /** how long stop() waits for the helper to clean up before terminating the distro */
  stopGraceMs?: number
  /** this PC's own IPv4 addresses (to spot WSL's mirrored networking) */
  hostIps: () => string[]
}

export const WSL_MISSING =
  'O IPsec da FortiGate no Windows usa o WSL, que não está ativo neste PC. Ative com "wsl --install" (pede reinício) ou use o FortiClient para esta VPN.'

function spawnWsl(args: string[], input: string, onOutput: (chunk: Buffer) => void): HelperRun {
  const child = spawn('wsl.exe', args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  child.stdout.on('data', onOutput)
  child.stderr.on('data', onOutput)
  child.stdin.on('error', () => {})
  child.stdin.end(input)
  const exited = new Promise<LaunchResult>((resolve) => {
    child.once('error', (error) =>
      resolve({
        code: null,
        error: new VpnError('UNSUPPORTED_ON_PLATFORM', `${WSL_MISSING} (${error.message})`)
      })
    )
    child.once('exit', (code) => resolve({ code }))
  })
  return { exited, stop: () => child.kill() }
}

export class WslIpsec {
  constructor(private readonly deps: WslIpsecDeps) {}

  /** WSL2 present and North's distro imported (re-imported when North ships a new one). */
  async ensure(): Promise<void> {
    const tarball = this.deps.tarball()
    if (!tarball) {
      throw new VpnError(
        'BINARY_MISSING',
        'O IPsec para Windows não veio nesta instalação do North'
      )
    }
    const status = await this.deps.wsl(['--status'])
    if (status.code !== 0) throw new VpnError('UNSUPPORTED_ON_PLATFORM', WSL_MISSING)
    const digest = this.deps.digest(tarball)
    if (digest && this.deps.imported.read() === digest) return
    await this.deps.wsl(['--unregister', WSL_DISTRO]) // a stale copy; fine if there was none
    this.deps.mkdir(this.deps.installDir)
    const result = await this.deps.wsl([
      '--import',
      WSL_DISTRO,
      this.deps.installDir,
      tarball,
      '--version',
      '2'
    ])
    if (result.code !== 0) {
      throw new VpnError(
        'UNSUPPORTED_ON_PLATFORM',
        `Não foi possível preparar o WSL para o IPsec (${result.stdout.trim() || `código ${result.code}`}). ${WSL_MISSING}`
      )
    }
    if (digest) this.deps.imported.write(digest)
  }

  /** "Remover componente de VPN": drops the distro (and its disk). No-op if never imported. */
  async remove(): Promise<void> {
    if (!this.deps.imported.read()) return
    const result = await this.deps.wsl(['--unregister', WSL_DISTRO])
    if (result.code !== 0) {
      throw new VpnError(
        'DRIVER_CRASHED',
        `Não foi possível remover o WSL do North (${result.stdout.trim() || `código ${result.code}`}). Remova com "wsl --unregister ${WSL_DISTRO}".`
      )
    }
    this.deps.imported.clear()
  }

  /** Same contract as VpnHelper.startIpsec: key=value lines on stdin, log out, stop() ends it. */
  startIpsec(input: string, onOutput: (chunk: Buffer) => void): HelperRun {
    const run = (this.deps.spawn ?? spawnWsl)(
      ['-d', WSL_DISTRO, '-u', 'root', '--', HELPER, 'ipsec'],
      input,
      onOutput
    )
    return {
      exited: run.exited,
      stop: () => {
        // killing wsl.exe doesn't reach the Linux side. All WSL distros share one network,
        // so charon-cmd must remove its routes/policies and the helper its NAT itself:
        // stop them first, then terminate the distro (frees its memory)
        void (async () => {
          await this.deps.wsl(['-d', WSL_DISTRO, '-u', 'root', '--', HELPER, 'stop-all'])
          await Promise.race([
            run.exited,
            new Promise((resolve) => setTimeout(resolve, this.deps.stopGraceMs ?? 5000))
          ])
          await this.deps.wsl(['--terminate', WSL_DISTRO])
          run.stop()
        })()
      }
    }
  }

  /** The WSL VM's address: Windows routes the VPN's networks to it. */
  async gatewayIp(): Promise<string> {
    const result = await this.deps.wsl([
      '-d',
      WSL_DISTRO,
      '-u',
      'root',
      '--',
      'ip',
      '-4',
      '-o',
      'addr',
      'show',
      'eth0'
    ])
    const ip = /inet ([0-9.]+)\//.exec(result.stdout)?.[1]
    if (!ip) throw new VpnError('DRIVER_CRASHED', 'Não foi possível descobrir o endereço do WSL')
    if (this.deps.hostIps().includes(ip)) {
      throw new VpnError(
        'UNSUPPORTED_ON_PLATFORM',
        'O WSL está em modo de rede espelhado (networkingMode=mirrored), em que o North não consegue rotear a VPN. Use o modo padrão (NAT) no .wslconfig ou o FortiClient para esta VPN.'
      )
    }
    return ip
  }
}
