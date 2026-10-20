import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: {} }))

const { linuxAutostartEntry, linuxAutostartFile } = await import('./login-item')

describe('launch at login (Linux autostart)', () => {
  it('lives in XDG autostart, honouring XDG_CONFIG_HOME', () => {
    expect(linuxAutostartFile('/home/ana', '')).toBe('/home/ana/.config/autostart/north.desktop')
    expect(linuxAutostartFile('/home/ana', '/cfg')).toBe('/cfg/autostart/north.desktop')
  })

  it('quotes an executable path with spaces', () => {
    expect(linuxAutostartEntry('/opt/North/north')).toContain('Exec=/opt/North/north\n')
    expect(linuxAutostartEntry('/home/ana/Apps/North 0.1.39.AppImage')).toContain(
      'Exec="/home/ana/Apps/North 0.1.39.AppImage"\n'
    )
  })
})
