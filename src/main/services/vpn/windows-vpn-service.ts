import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { connect, type Socket } from 'node:net'
import { win32 } from 'node:path'
import type { VpnHelperStatus } from '@shared/types'
import type { LaunchResult } from './privilege-broker'
import { VpnError } from './vpn-error'
import type { HelperRun } from './vpn-helper'

/**
 * Client for north-vpn-service (resources/vpn/windows-service): the Windows counterpart of
 * the root helper. One JSON request per pipe connection; for a tunnel the connection stays
 * open, streams the engine's log and ends with "NORTH-EXIT <code>". Closing it stops the tunnel.
 */
export const NORTH_VPN_PIPE = '\\\\.\\pipe\\north-vpn'
export const WINDOWS_SERVICE_NAME = 'NorthVpn'
export const SERVICE_DIR_NAME = 'North VPN Service'

/**
 * existsSync is false for a Windows named pipe that is listening. statSync sees it.
 * Anything other than "not there" counts as up, so a busy pipe is not treated as missing.
 */
export function namedPipeAlive(path: string, stat: (path: string) => void = statSync): boolean {
  try {
    stat(path)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return code !== 'ENOENT' && code !== 'ENOTDIR' && code !== 'ENXIO'
  }
}

/** `sc query` output. The state word stays RUNNING even on localized Windows. */
export function serviceQueryIsRunning(output: string): boolean {
  return /\bRUNNING\b/i.test(output)
}

function windowsServiceRunning(name: string): boolean {
  try {
    const output = execFileSync('sc.exe', ['query', name], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000
    })
    return serviceQueryIsRunning(output)
  } catch {
    return false
  }
}

export type FortiServiceRequest = {
  host: string
  port: number
  user: string
  password: string
  realm?: string
  /** sha256 of the gateway certificate (hex), always pinned */
  cert: string
}

export type WindowsServiceDeps = {
  /** bundled north-vpn-service.exe (next to its openconnect/ dir), or null when not packaged */
  bundled: () => string | null
  /** %ProgramFiles% */
  programFiles: string
  /** current user's SID (S-1-5-21-…) */
  userSid: () => Promise<string>
  digest: (path: string) => string | null
  elevate: (command: string) => Promise<void>
  pipe?: string
  open?: (path: string) => Socket
  /** whether the service's pipe exists, i.e. the service is running */
  pipeAlive?: () => boolean
}

const SID = /^S-1-(5-21|12-1)(-\d{1,10}){3,5}$/
const UNSAFE = /["%&|<>^\r\n\0]/

export function buildServiceInstall(exe: string, sid: string): string {
  if (!SID.test(sid)) throw new VpnError('INVALID_CONFIG', 'SID do usuário inválido')
  if (UNSAFE.test(exe)) throw new VpnError('INVALID_CONFIG', 'Caminho do serviço inválido')
  return `"${exe}" install --user-sid ${sid}`
}

export class WindowsVpnService {
  constructor(private readonly deps: WindowsServiceDeps) {}

  private installedExe(): string {
    return win32.join(this.deps.programFiles, SERVICE_DIR_NAME, 'north-vpn-service.exe')
  }

  /**
   * installed = the Program Files copy is byte-identical to the bundled one (updates re-install)
   * and the service is running; a stopped service also counts as outdated, so ensure()
   * re-runs the installer, which restarts it.
   */
  status(): VpnHelperStatus {
    const bundled = this.deps.bundled()
    if (!bundled) return 'unsupported'
    const installed = this.deps.digest(this.installedExe())
    if (!installed) return 'missing'
    if (installed !== this.deps.digest(bundled)) return 'outdated'
    const alive =
      this.deps.pipeAlive ??
      (() =>
        namedPipeAlive(this.deps.pipe ?? NORTH_VPN_PIPE) ||
        windowsServiceRunning(WINDOWS_SERVICE_NAME))
    return alive() ? 'installed' : 'outdated'
  }

  async ensure(): Promise<void> {
    if (this.status() === 'installed') return
    await this.install()
    if (this.status() !== 'installed') {
      throw new VpnError('DRIVER_CRASHED', 'Não foi possível instalar o componente de VPN do North')
    }
  }

  async installCommand(): Promise<string> {
    const bundled = this.deps.bundled()
    if (!bundled) {
      throw new VpnError('BINARY_MISSING', 'O serviço de VPN não veio nesta instalação do North')
    }
    return buildServiceInstall(bundled, await this.deps.userSid())
  }

  async install(): Promise<void> {
    await this.deps.elevate(await this.installCommand())
  }

  uninstallCommand(): string | null {
    if (this.status() === 'missing' || this.status() === 'unsupported') return null
    const exe = this.installedExe()
    if (UNSAFE.test(exe)) throw new VpnError('INVALID_CONFIG', 'Caminho do serviço inválido')
    return `"${exe}" uninstall`
  }

  async uninstall(): Promise<void> {
    const command = this.uninstallCommand()
    if (command) await this.deps.elevate(command)
  }

  /**
   * Windows routes for the VPN's networks through North's WSL distro (IPsec). Resolves once
   * they are in place; `stop()` (or North going away) makes the service remove them.
   */
  async holdRoutes(
    gateway: string,
    routes: string[],
    log: (line: string) => void
  ): Promise<HelperRun> {
    let ready: () => void = () => {}
    const added = new Promise<void>((r) => {
      ready = r
    })
    const run = this.request({ cmd: 'routes', gateway, routes }, (line) => {
      if (/^ROUTES-UP \d+$/.test(line)) ready()
      else log(line)
    })
    const outcome = await Promise.race([added.then(() => null), run.exited])
    if (outcome) {
      throw outcome.error ?? new VpnError('DRIVER_CRASHED', 'O Windows recusou as rotas da VPN')
    }
    return run
  }

  startForti(request: FortiServiceRequest, onOutput: (line: string) => void): HelperRun {
    return this.request({ cmd: 'forti', ...request, realm: request.realm ?? '' }, onOutput)
  }

  private request(payload: Record<string, unknown>, onOutput: (line: string) => void): HelperRun {
    const socket = (this.deps.open ?? connect)(this.deps.pipe ?? NORTH_VPN_PIPE)
    let buffer = ''
    let code: number | null = null
    const exited = new Promise<LaunchResult>((resolve) => {
      socket.once('connect', () => {
        socket.write(`${JSON.stringify(payload)}\n`)
      })
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8')
        let nl = buffer.indexOf('\n')
        while (nl >= 0) {
          const line = buffer.slice(0, nl).replace(/\r$/, '')
          buffer = buffer.slice(nl + 1)
          const exit = /^NORTH-EXIT (\d+)$/.exec(line)
          if (exit) code = Number(exit[1])
          else if (line.trim()) onOutput(line)
          nl = buffer.indexOf('\n')
        }
      })
      socket.once('error', (error: NodeJS.ErrnoException) => {
        resolve({
          code: null,
          error: new VpnError(
            error.code === 'ENOENT' ? 'BINARY_MISSING' : 'DRIVER_CRASHED',
            error.code === 'ENOENT'
              ? 'O serviço de VPN do North não está rodando. Reinstale o componente na página de VPNs.'
              : `Serviço de VPN do North: ${error.message}`
          )
        })
      })
      socket.once('close', () => resolve({ code }))
    })
    return {
      exited,
      // ending our side makes the service kill the engine (and report NORTH-EXIT)
      stop: () => {
        if (!socket.destroyed) socket.end()
      }
    }
  }
}
