import { win32 } from 'node:path'
import type { VpnHelperStatus } from '@shared/types'
import { VpnError } from './vpn-error'

/**
 * Windows counterpart of the root helper: the official OpenVPN package (its Interactive
 * Service runs as SYSTEM and starts openvpn.exe for the user, see windows-openvpn-service).
 * North ships the pinned MSI and installs it once, with one UAC prompt, without the
 * OpenVPN GUI. A non-admin user is added to "OpenVPN Administrators" in the same step,
 * which the service requires to accept North's options and config path.
 */
export const OPENVPN_DIR = 'C:\\Program Files\\OpenVPN'
const FEATURES = 'OpenVPN,OpenVPN.Service,Drivers,Drivers.Wintun,Drivers.OvpnDco'
const SAFE_USER = /^[^"%&|<>^\r\n\0]{1,104}$/

export type WindowsComponentDeps = {
  /** bundled OpenVPN-*.msi for this arch, or null when not packaged */
  msi: () => string | null
  user: string
  exists: (path: string) => boolean
  /** one UAC prompt running a cmd.exe command line (sudo-prompt on Windows) */
  elevate: (command: string) => Promise<void>
  /** marks that North (not the user) installed OpenVPN, so "remove" only undoes North's own */
  marker: { has: () => boolean; set: () => void; clear: () => void }
}

export function buildWindowsInstall(msi: string, user: string): string {
  if (!SAFE_USER.test(user)) throw new VpnError('INVALID_CONFIG', 'Nome de usuário inválido')
  if (/["%&|<>^\r\n\0]/.test(msi))
    throw new VpnError('INVALID_CONFIG', 'Caminho do instalador inválido')
  // an older MSI may name features differently: fall back to its defaults rather than fail
  const install = `msiexec /i "${msi}" /qn /norestart ADDLOCAL=${FEATURES}`
  const fallback = `msiexec /i "${msi}" /qn /norestart`
  // "already a member" is not an error worth failing the install for. "ver" resets the
  // error level; "exit /b 0" would end the whole elevated script (sudo-prompt runs it as a
  // batch file) and skip whatever comes after, i.e. north-vpn-service's install
  return `(${install} || ${fallback}) && (net localgroup "OpenVPN Administrators" "${user}" /add >nul 2>&1 || ver >nul)`
}

export function buildWindowsUninstall(msi: string): string {
  if (/["%&|<>^\r\n\0]/.test(msi))
    throw new VpnError('INVALID_CONFIG', 'Caminho do instalador inválido')
  return `msiexec /x "${msi}" /qn /norestart`
}

export class WindowsVpnComponent {
  constructor(private readonly deps: WindowsComponentDeps) {}

  status(): VpnHelperStatus {
    const ok =
      this.deps.exists(win32.join(OPENVPN_DIR, 'bin', 'openvpn.exe')) &&
      this.deps.exists(win32.join(OPENVPN_DIR, 'bin', 'openvpnserv.exe'))
    if (ok) return 'installed'
    return this.deps.msi() ? 'missing' : 'unsupported'
  }

  async ensure(): Promise<void> {
    if (this.status() === 'installed') return
    await this.install()
    if (this.status() !== 'installed') {
      throw new VpnError('DRIVER_CRASHED', 'Não foi possível instalar o componente de VPN do North')
    }
  }

  installCommand(): string {
    const msi = this.deps.msi()
    if (!msi) {
      throw new VpnError(
        'BINARY_MISSING',
        'O instalador do OpenVPN não veio nesta instalação do North'
      )
    }
    return buildWindowsInstall(msi, this.deps.user)
  }

  /** after installCommand ran: remember North put OpenVPN there (if it wasn't before) */
  installed(wasInstalled: boolean): void {
    if (!wasInstalled) this.deps.marker.set()
  }

  async install(): Promise<void> {
    const wasInstalled = this.status() === 'installed'
    await this.deps.elevate(this.installCommand())
    this.installed(wasInstalled)
  }

  /** Only removes an OpenVPN that North itself installed (null: nothing to remove). */
  uninstallCommand(): string | null {
    const msi = this.deps.msi()
    return msi && this.deps.marker.has() ? buildWindowsUninstall(msi) : null
  }

  uninstalled(): void {
    this.deps.marker.clear()
  }

  async uninstall(): Promise<void> {
    const command = this.uninstallCommand()
    if (!command) return
    await this.deps.elevate(command)
    this.uninstalled()
  }
}
