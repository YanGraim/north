import type { VpnStatus } from '@shared/types'
import type { MenuItemConstructorOptions } from 'electron'

/**
 * The tray menu (macOS menu bar, Windows notification area, Linux tray): quick VPN
 * connect/disconnect like FortiClient's, without opening the window. Pure, so it's tested
 * without Electron.
 */
export type TrayVpn = { id: string; name: string; status: VpnStatus }

/** The colored dot beside each VPN: green up, amber on its way, gray off. */
export type TrayDot = 'on' | 'busy' | 'off'

export type TrayActions = {
  connect: (id: string) => void
  disconnect: (id: string) => void
  open: () => void
  quit: () => void
  /** The dot image for a status (left out in tests). */
  dot?: (dot: TrayDot) => MenuItemConstructorOptions['icon']
}

/**
 * Only the active workspace's VPNs, so a profile copied into an organization does not show
 * twice; a tunnel still up from another workspace stays, so it can be turned off.
 */
export function trayVpns(
  profiles: readonly { id: string; name: string; workspaceId?: string }[],
  workspace: string,
  status: (id: string) => VpnStatus
): TrayVpn[] {
  return profiles
    .map((p) => ({ id: p.id, name: p.name, status: status(p.id), ws: p.workspaceId ?? 'local' }))
    .filter((p) => p.ws === workspace || trayDot(p.status) !== 'off')
    .map(({ ws: _ws, ...vpn }) => vpn)
}

export function trayDot(status: VpnStatus): TrayDot {
  if (status === 'connected') return 'on'
  if (status === 'connecting' || status === 'reconnecting' || status === 'disconnecting') {
    return 'busy'
  }
  return 'off'
}

function vpnItem(vpn: TrayVpn, actions: TrayActions): MenuItemConstructorOptions {
  return { ...vpnAction(vpn, actions), icon: actions.dot?.(trayDot(vpn.status)) }
}

function vpnAction(vpn: TrayVpn, actions: TrayActions): MenuItemConstructorOptions {
  switch (vpn.status) {
    case 'connected':
      return { label: `Desconectar de ${vpn.name}`, click: () => actions.disconnect(vpn.id) }
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

/** The tray glyph itself: one green ellipse while any VPN is up. Other states stay the plain N. */
export function trayShowsVpnBadge(vpns: readonly TrayVpn[]): boolean {
  return vpns.some((vpn) => vpn.status === 'connected')
}
