import { describe, expect, it } from 'vitest'
import {
  buildWindowsInstall,
  groupListsUser,
  type WindowsComponentDeps,
  WindowsVpnComponent,
  windowsAccountName
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

describe('Windows account and OpenVPN Administrators', () => {
  it('qualifies domain and Entra ID accounts, keeps local ones bare', () => {
    expect(windowsAccountName({ USERDOMAIN: 'AzureAD', COMPUTERNAME: 'NB-01' }, 'AnaMaria')).toBe(
      'AzureAD\\AnaMaria'
    )
    expect(windowsAccountName({ USERDOMAIN: 'NB-01', COMPUTERNAME: 'nb-01' }, 'ana')).toBe('ana')
    expect(windowsAccountName({}, 'ana')).toBe('ana')
  })

  const OUTPUT = [
    'Alias name     OpenVPN Administrators',
    '',
    'Members',
    '',
    '-------------------------------------------------------------------------------',
    'NB-01\\ana',
    'AzureAD\\JoaoSilva',
    'The command completed successfully.'
  ].join('\r\n')

  it('finds the account in net localgroup output', () => {
    expect(groupListsUser(OUTPUT, 'ana')).toBe(true)
    expect(groupListsUser(OUTPUT, 'azuread\\joaosilva')).toBe(true)
    expect(groupListsUser(OUTPUT, 'AzureAD\\ana')).toBe(false)
    expect(groupListsUser(OUTPUT, 'maria')).toBe(false)
  })

  it('adds a missing user once when OpenVPN was already installed', async () => {
    const { d, files, commands } = deps({
      user: 'AzureAD\\Maria',
      listGroup: async () => OUTPUT
    })
    files.add('C:\\Program Files\\OpenVPN\\bin\\openvpn.exe')
    files.add('C:\\Program Files\\OpenVPN\\bin\\openvpnserv.exe')
    const component = new WindowsVpnComponent(d)
    await component.ensureMembership()
    await component.ensureMembership()
    expect(commands).toEqual(['net localgroup "OpenVPN Administrators" "AzureAD\\Maria" /add'])
  })

  it('no prompt when the user is already a member', async () => {
    const { d, files, commands } = deps({ user: 'ana', listGroup: async () => OUTPUT })
    files.add('C:\\Program Files\\OpenVPN\\bin\\openvpn.exe')
    files.add('C:\\Program Files\\OpenVPN\\bin\\openvpnserv.exe')
    await new WindowsVpnComponent(d).ensureMembership()
    expect(commands).toEqual([])
  })
})
