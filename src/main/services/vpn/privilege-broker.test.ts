import { describe, expect, it, vi } from 'vitest'
import {
  buildElevatedCommand,
  findOpenfortivpnBinary,
  findOpenvpnBinary,
  SudoPromptBroker
} from './privilege-broker'
import { VpnError } from './vpn-error'

describe('findOpenvpnBinary', () => {
  it('returns the first existing candidate per platform', () => {
    const exists = (p: string) => p === '/usr/local/sbin/openvpn'
    expect(findOpenvpnBinary('darwin', exists)).toBe('/usr/local/sbin/openvpn')
    expect(findOpenvpnBinary('linux', (p) => p === '/opt/homebrew/sbin/openvpn')).toBeNull()
    expect(findOpenvpnBinary('win32', (p) => p.endsWith('openvpn.exe'))).toMatch(
      /OpenVPN\\bin\\openvpn\.exe$/
    )
  })
})

describe('findOpenfortivpnBinary', () => {
  it('mac (Homebrew) and Linux paths; none on Windows', () => {
    expect(findOpenfortivpnBinary('darwin', (p) => p === '/opt/homebrew/bin/openfortivpn')).toBe(
      '/opt/homebrew/bin/openfortivpn'
    )
    expect(findOpenfortivpnBinary('linux', (p) => p === '/usr/bin/openfortivpn')).toBe(
      '/usr/bin/openfortivpn'
    )
    expect(findOpenfortivpnBinary('win32', () => true)).toBeNull()
  })
  it('prefers the engine bundled with North over a system install', () => {
    const exists = (p: string) =>
      p === '/app/vpn-bin/openfortivpn' || p === '/opt/homebrew/bin/openfortivpn'
    expect(findOpenfortivpnBinary('darwin', exists, '/app/vpn-bin')).toBe(
      '/app/vpn-bin/openfortivpn'
    )
    expect(findOpenfortivpnBinary('darwin', exists, '/missing')).toBe(
      '/opt/homebrew/bin/openfortivpn'
    )
  })
})

describe('buildElevatedCommand', () => {
  it('quotes binary and every argument', () => {
    expect(
      buildElevatedCommand('/opt/homebrew/sbin/openvpn', ['--config', "/tmp/a b'c.ovpn"])
    ).toBe(`'/opt/homebrew/sbin/openvpn' '--config' '/tmp/a b'\\''c.ovpn'`)
  })

  it('rejects relative binaries and line breaks', () => {
    expect(() => buildElevatedCommand('openvpn', [])).toThrow(/absolute/)
    expect(() => buildElevatedCommand('/bin/x', ['a\nb'])).toThrow()
  })
})

describe('SudoPromptBroker', () => {
  it('maps a cancelled prompt to PRIVILEGE_DENIED', async () => {
    const exec = vi.fn((_cmd: string, _opts: unknown, cb: (e?: Error) => void) =>
      cb(new Error('User did not grant permission.'))
    )
    const broker = new SudoPromptBroker(exec)
    const proc = broker.launch('/usr/sbin/openvpn', ['--version'])
    const result = await proc.exited
    expect(result.error).toBeInstanceOf(VpnError)
    expect(result.error?.code).toBe('PRIVILEGE_DENIED')
    expect(exec.mock.calls[0][0]).toBe(`'/usr/sbin/openvpn' '--version'`)
    expect(exec.mock.calls[0][1]).toMatchObject({ name: 'North' })
  })

  it('a normal exit resolves with code 0 and no error', async () => {
    const broker = new SudoPromptBroker((_c, _o, cb) => cb(undefined))
    expect(await broker.launch('/usr/sbin/openvpn', []).exited).toEqual({ code: 0 })
  })

  it('other failures keep the process exit as DRIVER_CRASHED', async () => {
    const broker = new SudoPromptBroker((_c, _o, cb) => cb(new Error('Command failed: exit 1')))
    const result = await broker.launch('/usr/sbin/openvpn', []).exited
    expect(result.error?.code).toBe('DRIVER_CRASHED')
  })
})
