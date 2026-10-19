import { describe, expect, it } from 'vitest'
import { WindowsVpnComponent } from './windows-vpn-component'
import { WindowsVpnService } from './windows-vpn-service'
import { WindowsVpnSetup } from './windows-vpn-setup'

const SVC = 'C:\\Program Files\\North VPN Service\\north-vpn-service.exe'

function setup() {
  const files = new Map<string, string>()
  const commands: string[] = []
  const elevate = async (cmd: string) => {
    commands.push(cmd)
    if (cmd.includes('msiexec /i')) {
      files.set('C:\\Program Files\\OpenVPN\\bin\\openvpn.exe', 'x')
      files.set('C:\\Program Files\\OpenVPN\\bin\\openvpnserv.exe', 'x')
    }
    if (cmd.includes('install --user-sid')) files.set(SVC, 'svc-1')
  }
  const openvpn = new WindowsVpnComponent({
    msi: () => 'C:\\North\\vpn-bin\\OpenVPN.msi',
    user: 'ana',
    exists: (p) => files.has(p),
    elevate,
    marker: {
      has: () => files.has('marker'),
      set: () => void files.set('marker', ''),
      clear: () => void files.delete('marker')
    }
  })
  const service = new WindowsVpnService({
    bundled: () => 'C:\\North\\vpn-bin\\north-vpn-service.exe',
    programFiles: 'C:\\Program Files',
    userSid: async () => 'S-1-5-21-1-2-3-1001',
    digest: (p) =>
      p === 'C:\\North\\vpn-bin\\north-vpn-service.exe' ? 'svc-1' : (files.get(p) ?? null),
    elevate
  })
  return { s: new WindowsVpnSetup(openvpn, service, elevate), commands, files }
}

describe('WindowsVpnSetup', () => {
  it('installs OpenVPN and the North service with a single UAC prompt', async () => {
    const { s, commands } = setup()
    expect(s.status()).toBe('missing')
    await s.ensure()
    await s.ensure()
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatch(
      /msiexec \/i .* && "C:\\North\\vpn-bin\\north-vpn-service.exe" install --user-sid S-1-5-21-1-2-3-1001$/
    )
    expect(s.status()).toBe('installed')
  })

  it('an update with a new service only re-installs the service', async () => {
    const { s, commands, files } = setup()
    await s.install()
    files.set(SVC, 'svc-0')
    expect(s.status()).toBe('outdated')
    await s.install()
    expect(commands[1]).not.toContain('msiexec')
    expect(commands[1]).toContain('install --user-sid')
  })

  it('remove: the service, and OpenVPN only because North installed it', async () => {
    const { s, commands } = setup()
    await s.install()
    await s.uninstall()
    expect(commands[1]).toBe(
      `"${SVC}" uninstall & msiexec /x "C:\\North\\vpn-bin\\OpenVPN.msi" /qn /norestart`
    )
  })
})
