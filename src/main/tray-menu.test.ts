import { describe, expect, it, vi } from 'vitest'
import { buildTrayMenu, type TrayVpn, trayTooltip } from './tray-menu'

const actions = () => ({ connect: vi.fn(), disconnect: vi.fn(), open: vi.fn(), quit: vi.fn() })
const click = (item: { click?: unknown }) => (item.click as () => void)()

describe('buildTrayMenu', () => {
  it('lists every VPN by name with the action its state allows, then open/quit', () => {
    const vpns: TrayVpn[] = [
      { id: 'p', name: 'POLY', status: 'connected' },
      { id: 'g', name: 'GRUPPE', status: 'disconnected' },
      { id: 'm', name: 'METALNOX', status: 'connecting' },
      { id: 'x', name: 'PAC', status: 'error' }
    ]
    const a = actions()
    const menu = buildTrayMenu(vpns, a)
    expect(menu.map((i) => i.label ?? i.type)).toEqual([
      'VPN',
      'Conectar a GRUPPE',
      'METALNOX — conectando…',
      'Conectar a PAC',
      'Desconectar de POLY',
      'separator',
      'Abrir North',
      'Sair do North'
    ])

    click(menu[1])
    expect(a.connect).toHaveBeenCalledWith('g')
    click(menu[4])
    expect(a.disconnect).toHaveBeenCalledWith('p')
    // a connection that hangs can be cancelled from the tray
    click(menu[2])
    expect(a.disconnect).toHaveBeenCalledWith('m')
    click(menu[7])
    expect(a.quit).toHaveBeenCalled()
  })

  it('puts a status dot beside each VPN: green up, amber on its way, gray off', () => {
    const vpns: TrayVpn[] = [
      { id: 'a', name: 'A', status: 'connected' },
      { id: 'b', name: 'B', status: 'reconnecting' },
      { id: 'c', name: 'C', status: 'error' }
    ]
    const menu = buildTrayMenu(vpns, { ...actions(), dot: (d) => `dot-${d}` })
    expect(menu.slice(1, 4).map((i) => i.icon)).toEqual(['dot-on', 'dot-busy', 'dot-off'])
  })

  it('no VPN yet: says so, still opens and quits North', () => {
    const menu = buildTrayMenu([], actions())
    expect(menu[1]).toMatchObject({ label: 'Nenhuma VPN cadastrada', enabled: false })
    expect(menu.at(-2)?.label).toBe('Abrir North')
  })

  it('a VPN going down cannot be clicked twice', () => {
    const menu = buildTrayMenu([{ id: 'p', name: 'POLY', status: 'disconnecting' }], actions())
    expect(menu[1]).toMatchObject({ enabled: false })
  })
})

describe('trayTooltip', () => {
  it('names the connected VPNs', () => {
    expect(
      trayTooltip([
        { id: 'p', name: 'POLY', status: 'connected' },
        { id: 'g', name: 'GRUPPE', status: 'disconnected' }
      ])
    ).toBe('North — VPN: POLY')
    expect(trayTooltip([])).toBe('North')
  })
})
