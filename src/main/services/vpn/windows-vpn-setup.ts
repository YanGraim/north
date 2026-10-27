import type { VpnHelperStatus } from '@shared/types'
import { VpnError } from './vpn-error'
import type { WindowsVpnComponent } from './windows-vpn-component'
import type { WindowsVpnService } from './windows-vpn-service'
import type { WslIpsec } from './wsl-ipsec'

/**
 * What the VPNs page calls "the VPN component" on Windows: the OpenVPN package (OpenVPN
 * tunnels) plus north-vpn-service (FortiGate SSL-VPN). Both go in with ONE UAC prompt.
 * North's WSL distro (IPsec) is imported on the first IPsec connect and removed with them.
 */
export class WindowsVpnSetup {
  constructor(
    private readonly openvpn: WindowsVpnComponent,
    private readonly service: WindowsVpnService,
    private readonly elevate: (command: string) => Promise<void>,
    private readonly wsl?: Pick<WslIpsec, 'remove'>,
    /** how long ensure() waits for the service to start after installing it */
    private readonly settleMs = 10_000
  ) {}

  status(): VpnHelperStatus {
    const parts = [this.openvpn.status(), this.service.status()].filter((s) => s !== 'unsupported')
    if (parts.length === 0) return 'unsupported'
    if (parts.every((s) => s === 'installed')) return 'installed'
    return parts.includes('outdated') ? 'outdated' : 'missing'
  }

  async ensure(): Promise<void> {
    if (this.status() === 'installed') return
    await this.install()
    // the service opens its pipe a moment after the installer returns
    const deadline = Date.now() + this.settleMs
    while (this.status() !== 'installed' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500))
    }
    if (this.status() === 'installed') return
    const missing = [
      this.openvpn.status() === 'installed' || this.openvpn.status() === 'unsupported'
        ? null
        : 'OpenVPN',
      this.service.status() === 'installed' || this.service.status() === 'unsupported'
        ? null
        : 'serviço North VPN'
    ].filter(Boolean)
    throw new VpnError(
      'DRIVER_CRASHED',
      `Não foi possível instalar o componente de VPN do North (faltou: ${missing.join(', ')})`
    )
  }

  async install(): Promise<void> {
    const commands: string[] = []
    const openvpn = this.openvpn.status()
    if (openvpn !== 'installed' && openvpn !== 'unsupported')
      commands.push(this.openvpn.installCommand())
    const service = this.service.status()
    if (service !== 'installed' && service !== 'unsupported')
      commands.push(await this.service.installCommand())
    if (commands.length === 0) return
    await this.elevate(commands.join(' && '))
    this.openvpn.installed(openvpn === 'installed')
  }

  async uninstall(): Promise<void> {
    const openvpn = this.openvpn.uninstallCommand()
    const commands = [this.service.uninstallCommand(), openvpn].filter((c): c is string => !!c)
    if (commands.length > 0) {
      // "&": remove whatever can be removed even if one part fails
      await this.elevate(commands.join(' & '))
      if (openvpn) this.openvpn.uninstalled()
    }
    // the distro is per-user: no UAC needed
    await this.wsl?.remove()
  }
}
