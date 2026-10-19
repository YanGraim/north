import { describe, expect, it } from 'vitest'
import { StrongswanDriver } from './drivers/strongswan-driver'
import type { VpnError } from './vpn-error'
import type { HelperRun } from './vpn-helper'
import { WSL_DISTRO, WslIpsec, type WslIpsecDeps } from './wsl-ipsec'

function deps(over: Partial<WslIpsecDeps> = {}) {
  const calls: string[][] = []
  let imported: string | null = null
  const d: WslIpsecDeps = {
    tarball: () => 'C:\\North\\vpn-bin\\north-wsl.tar.gz',
    digest: () => 'tar-v1',
    installDir: 'C:\\Users\\ana\\AppData\\Roaming\\North\\vpn\\wsl',
    imported: {
      read: () => imported,
      write: (v) => {
        imported = v
      }
    },
    wsl: async (args) => {
      calls.push(args)
      if (args.includes('ip'))
        return {
          code: 0,
          stdout: '5: eth0    inet 172.28.80.5/20 brd 172.28.95.255 scope global eth0'
        }
      return { code: 0, stdout: '' }
    },
    hostIps: () => ['192.168.1.20'],
    ...over
  }
  return { d, calls }
}

describe('WslIpsec', () => {
  it("imports North's distro once, and again only when North ships a new one", async () => {
    const { d, calls } = deps()
    const wsl = new WslIpsec(d)
    await wsl.ensure()
    await wsl.ensure()
    const imports = calls.filter((c) => c[0] === '--import')
    expect(imports).toEqual([
      [
        '--import',
        WSL_DISTRO,
        d.installDir,
        'C:\\North\\vpn-bin\\north-wsl.tar.gz',
        '--version',
        '2'
      ]
    ])
  })

  it('no WSL → tells how to enable it or use FortiClient', async () => {
    const { d } = deps({ wsl: async () => ({ code: 1, stdout: '' }) })
    const error = (await new WslIpsec(d).ensure().catch((e) => e)) as VpnError
    expect(error.code).toBe('UNSUPPORTED_ON_PLATFORM')
    expect(error.message).toMatch(/wsl --install.*FortiClient/)
  })

  it('finds the WSL VM address, and refuses mirrored networking (VM shares the host IP)', async () => {
    expect(await new WslIpsec(deps().d).gatewayIp()).toBe('172.28.80.5')
    const mirrored = new WslIpsec(deps({ hostIps: () => ['172.28.80.5'] }).d)
    await expect(mirrored.gatewayIp()).rejects.toThrow(/espelhado/)
  })

  it('runs the helper as root in the distro; stopping terminates the VM', async () => {
    const { d, calls } = deps()
    const spawned: string[][] = []
    const wsl = new WslIpsec({
      ...d,
      spawn: (args) => {
        spawned.push(args)
        return { exited: new Promise(() => {}), stop: () => {} }
      }
    })
    wsl.startIpsec('host=x\n', () => {}).stop()
    expect(spawned[0]).toEqual([
      '-d',
      WSL_DISTRO,
      '-u',
      'root',
      '--',
      '/opt/north/north-vpn-helper',
      'ipsec'
    ])
    expect(calls).toContainEqual(['--terminate', WSL_DISTRO])
  })
})

describe('StrongswanDriver on Windows (tunnel hook)', () => {
  const ctx = () => ({
    profile: {
      id: 'poly',
      name: 'POLY',
      config: { kind: 'ipsec-ikev1', gateway: 'vpn.poly.example', username: 'ana', groupName: '' }
    } as never,
    secrets: { get: () => 'x', inlineBlocks: () => ({}), values: () => [] },
    log: () => {},
    signal: new AbortController().signal
  })
  const upHelper = () => {
    let stopped = false
    return {
      stopped: () => stopped,
      helper: {
        ensure: async () => {},
        startIpsec: (_input: string, onOutput: (c: Buffer) => void): HelperRun => {
          setTimeout(() => {
            onOutput(Buffer.from('installing new virtual IP 10.10.20.5\n'))
            onOutput(
              Buffer.from(
                'CHILD_SA cmd{1} established with SPIs a_i b_o and TS 10.10.20.5/32 === 172.16.0.0/20 172.16.50.0/24\n'
              )
            )
          }, 5)
          return {
            exited: new Promise(() => {}),
            stop: () => {
              stopped = true
            }
          }
        }
      }
    }
  }

  it('adds the Windows routes once up and removes them on disconnect', async () => {
    const h = upHelper()
    const events: string[] = []
    const driver = new StrongswanDriver({
      binary: () => 'tar',
      helper: h.helper,
      stopTimeoutMs: 10,
      tunnel: {
        up: async (info) => {
          events.push(`up ${info.routes.join(',')}`)
          return () => events.push('routes removed')
        }
      }
    })
    const info = await driver.connect(ctx())
    expect(info.routes).toEqual(['172.16.0.0/20', '172.16.50.0/24'])
    await driver.disconnect()
    expect(events).toEqual(['up 172.16.0.0/20,172.16.50.0/24', 'routes removed'])
    expect(h.stopped()).toBe(true)
  })

  it('routes refused → the tunnel is torn down and the error surfaces', async () => {
    const h = upHelper()
    const driver = new StrongswanDriver({
      binary: () => 'tar',
      helper: h.helper,
      stopTimeoutMs: 10,
      tunnel: {
        up: async () => {
          throw new Error('route refused')
        }
      }
    })
    await expect(driver.connect(ctx())).rejects.toThrow('route refused')
    expect(h.stopped()).toBe(true)
  })
})
