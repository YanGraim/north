import { describe, expect, it } from 'vitest'
import { WindowsVpnComponent } from './windows-vpn-component'
import { WindowsVpnService } from './windows-vpn-service'
import { WindowsVpnSetup } from './windows-vpn-setup'

const SVC = 'C:\\Program Files\\North VPN Service\\north-vpn-service.exe'

function setup() {
  const files = new Map<string, string>()
  let running = false
  const commands: string[] = []
  const elevate = async (cmd: string) => {
    commands.push(cmd)
    if (cmd.includes('msiexec /i')) {
      files.set('C:\\Program Files\\OpenVPN\\bin\\openvpn.exe', 'x')
      files.set('C:\\Program Files\\OpenVPN\\bin\\openvpnserv.exe', 'x')
    }
    if (cmd.includes('install --user-sid')) {
      files.set(SVC, 'svc-1')
      running = true
    }
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
    elevate,
    pipeAlive: () => running
  })
  const wslRemoved: string[] = []
  const wsl = {
    remove: async () => {
      wslRemoved.push('NorthVpn')
    }
  }
  return {
    s: new WindowsVpnSetup(openvpn, service, elevate, wsl, 0),
    wslRemoved,
    commands,
    files,
    stop: () => {
      running = false
    }
  }
}

describe('WindowsVpnSetup', () => {
  it('never ends the elevated batch before the service install runs', async () => {
    const { s, commands } = setup()
    await s.ensure()
    // sudo-prompt runs the command as a .bat: "exit /b" there skips everything after it
    expect(commands[0]).not.toMatch(/exit \/b/i)
  })

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

  it('a stopped service is re-installed, which starts it again', async () => {
    const { s, commands, stop } = setup()
    await s.ensure()
    stop()
    expect(s.status()).toBe('outdated')
    await s.ensure()
    expect(commands[1]).not.toContain('msiexec')
    expect(commands[1]).toContain('install --user-sid')
    expect(s.status()).toBe('installed')
  })

  it('remove: the service, OpenVPN only because North installed it, and the WSL distro', async () => {
    const { s, commands, wslRemoved } = setup()
    await s.install()
    await s.uninstall()
    expect(wslRemoved).toEqual(['NorthVpn'])
    expect(commands[1]).toBe(
      `"${SVC}" uninstall & msiexec /x "C:\\North\\vpn-bin\\OpenVPN.msi" /qn /norestart`
    )
  })
})
