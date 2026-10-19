import { describe, expect, it } from 'vitest'
import {
  buildWindowsInstall,
  type WindowsComponentDeps,
  WindowsVpnComponent
} from './windows-vpn-component'

const MSI = 'C:\\Program Files\\North\\resources\\vpn-bin\\OpenVPN-2.6.14-I001-amd64.msi'

function deps(over: Partial<WindowsComponentDeps> = {}) {
  const files = new Set<string>()
  let marked = false
  const commands: string[] = []
  const d: WindowsComponentDeps = {
    msi: () => MSI,
    user: 'Ana Maria',
    exists: (p) => files.has(p),
    elevate: async (cmd) => {
      commands.push(cmd)
      if (cmd.startsWith('(msiexec /i')) {
        files.add('C:\\Program Files\\OpenVPN\\bin\\openvpn.exe')
        files.add('C:\\Program Files\\OpenVPN\\bin\\openvpnserv.exe')
      }
    },
    marker: {
      has: () => marked,
      set: () => {
        marked = true
      },
      clear: () => {
        marked = false
      }
    },
    ...over
  }
  return { d, files, commands, marked: () => marked }
}

describe('buildWindowsInstall', () => {
  it('silent MSI without the GUI, with a fallback, and the user in OpenVPN Administrators', () => {
    const cmd = buildWindowsInstall(MSI, 'Ana Maria')
    expect(cmd).toContain(`msiexec /i "${MSI}" /qn /norestart ADDLOCAL=OpenVPN,OpenVPN.Service,`)
    expect(cmd).not.toContain('OpenVPN.GUI')
    expect(cmd).toContain('|| msiexec /i')
    expect(cmd).toContain('net localgroup "OpenVPN Administrators" "Ana Maria" /add')
  })
  it('rejects names that could break out of cmd.exe quoting', () => {
    expect(() => buildWindowsInstall(MSI, 'x" & calc & "')).toThrow()
    expect(() => buildWindowsInstall('C:\\a&b.msi', 'ana')).toThrow()
  })
})

describe('WindowsVpnComponent', () => {
  it('installs once (one UAC prompt), then reports installed', async () => {
    const { d, commands } = deps()
    const c = new WindowsVpnComponent(d)
    expect(c.status()).toBe('missing')
    await c.ensure()
    await c.ensure()
    expect(commands).toHaveLength(1)
    expect(c.status()).toBe('installed')
  })
  it('unsupported when the MSI is not bundled (dev, non-packaged)', () => {
    expect(new WindowsVpnComponent(deps({ msi: () => null }).d).status()).toBe('unsupported')
  })
  it('never uninstalls an OpenVPN the user had installed before North', async () => {
    const { d, commands, files } = deps()
    files.add('C:\\Program Files\\OpenVPN\\bin\\openvpn.exe')
    files.add('C:\\Program Files\\OpenVPN\\bin\\openvpnserv.exe')
    const c = new WindowsVpnComponent(d)
    await c.uninstall()
    expect(commands).toHaveLength(0)
  })
  it('removes the OpenVPN North installed', async () => {
    const { d, commands, marked } = deps()
    const c = new WindowsVpnComponent(d)
    await c.install()
    await c.uninstall()
    expect(commands[1]).toBe(`msiexec /x "${MSI}" /qn /norestart`)
    expect(marked()).toBe(false)
  })
})
