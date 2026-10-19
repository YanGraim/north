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
export const SERVICE_DIR_NAME = 'North VPN Service'

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

  /** installed = the Program Files copy is byte-identical to the bundled one (updates re-install) */
  status(): VpnHelperStatus {
    const bundled = this.deps.bundled()
    if (!bundled) return 'unsupported'
    const installed = this.deps.digest(this.installedExe())
    if (!installed) return 'missing'
    return installed === this.deps.digest(bundled) ? 'installed' : 'outdated'
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

  startForti(request: FortiServiceRequest, onOutput: (line: string) => void): HelperRun {
    const socket = (this.deps.open ?? connect)(this.deps.pipe ?? NORTH_VPN_PIPE)
    let buffer = ''
    let code: number | null = null
    const exited = new Promise<LaunchResult>((resolve) => {
      socket.once('connect', () => {
        socket.write(
          `${JSON.stringify({ cmd: 'forti', ...request, realm: request.realm ?? '' })}\n`
        )
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
