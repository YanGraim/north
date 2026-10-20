import type { VpnStatus } from '@shared/types'
import type { MenuItemConstructorOptions } from 'electron'

/**
 * The tray menu (macOS menu bar, Windows notification area, Linux tray): quick VPN
 * connect/disconnect like FortiClient's, without opening the window. Pure, so it's tested
 * without Electron.
 */
export type TrayVpn = { id: string; name: string; status: VpnStatus }

export type TrayActions = {
  connect: (id: string) => void
  disconnect: (id: string) => void
  open: () => void
  quit: () => void
}

function vpnItem(vpn: TrayVpn, actions: TrayActions): MenuItemConstructorOptions {
  switch (vpn.status) {
    case 'connected':
      return {
        label: `Desconectar de ${vpn.name}`,
        type: 'checkbox',
        checked: true,
        click: () => actions.disconnect(vpn.id)
      }
    case 'connecting':
    case 'reconnecting':
      return {
        label: `${vpn.name} — conectando…`,
        click: () => actions.disconnect(vpn.id)
      }
    case 'disconnecting':
      return { label: `${vpn.name} — desconectando…`, enabled: false }
    default:
      return { label: `Conectar a ${vpn.name}`, click: () => actions.connect(vpn.id) }
  }
}

export function buildTrayMenu(vpns: TrayVpn[], actions: TrayActions): MenuItemConstructorOptions[] {
  const sorted = [...vpns].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return [
    { label: 'VPN', enabled: false },
    ...(sorted.length > 0
      ? sorted.map((vpn) => vpnItem(vpn, actions))
      : [{ label: 'Nenhuma VPN cadastrada', enabled: false }]),
    { type: 'separator' },
    { label: 'Abrir North', click: actions.open },
    { label: 'Sair do North', click: actions.quit }
  ]
}

/** Hover text: which VPNs are up. */
export function trayTooltip(vpns: TrayVpn[]): string {
  const up = vpns.filter((v) => v.status === 'connected').map((v) => v.name)
  return up.length > 0 ? `North — VPN: ${up.join(', ')}` : 'North'
}
