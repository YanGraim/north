import type { VpnProfile, WindowsNativeVpnConfig } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import type { VpnConnectContext } from './vpn-driver'
import {
  buildEntryScript,
  type ProcessResult,
  rasError,
  rasErrorCode,
  WindowsNativeDriver,
  windowsEntryName
} from './windows-native-driver'

const config = (patch: Partial<WindowsNativeVpnConfig> = {}): WindowsNativeVpnConfig => ({
  kind: 'windows-native',
  gateway: '189.28.191.222',
  protocol: 'pptp',
  username: 'ana',
  fullTunnel: false,
  ...patch
})

function context(cfg: WindowsNativeVpnConfig, secrets: Record<string, string>): VpnConnectContext {
  return {
    profile: { id: 'p1', name: "ECOFITUS d'Ana", config: cfg } as VpnProfile,
    secrets: { get: (k) => secrets[k] ?? null, inlineBlocks: () => ({}) },
    log: () => {},
    signal: new AbortController().signal
  }
}

const ok = (stdout = ''): ProcessResult => ({ code: 0, stdout, stderr: '' })

describe('windows native VPN driver', () => {
  it('builds a secret-free script that escapes the entry name and keeps split tunneling', () => {
    const script = buildEntryScript(
      windowsEntryName("ECOFITUS d'Ana"),
      config({ routes: ['10.0.0.0/8', 'bad; rm'] })
    )
    expect(script).toContain("$name = 'North ECOFITUS dAna'")
    expect(script).toContain("TunnelType = 'Pptp'")
    expect(script).toContain('SplitTunneling = $true')
    expect(script).toContain("-DestinationPrefix '10.0.0.0/8'")
    expect(script).not.toContain('bad; rm')
    expect(buildEntryScript('North X', config({ protocol: 'l2tp' }))).toContain(
      '$p.L2tpPsk = $in.psk'
    )
  })

  it('connects without ever putting the password or PSK on a command line', async () => {
    const calls: Array<{ cmd: string; args: string[]; stdin?: string }> = []
    const driver = new WindowsNativeDriver({
      run: async (cmd, args, stdin) => {
        calls.push({ cmd, args, stdin })
        if (cmd === 'powershell' && !stdin) return ok('10.8.0.5\r\n')
        return ok('Connected to North ECOFITUS dAna\r\nCommand completed successfully.')
      },
      routes: async () => ['10.8.0.0/24'],
      pollMs: 60_000
    })
    const info = await driver.connect(
      context(config({ protocol: 'l2tp' }), { password: 's3cr3t!', psk: 'chave-psk' })
    )
    expect(info).toEqual({ localIp: '10.8.0.5', routes: ['10.8.0.0/24'], redirectGateway: false })
    const argv = calls.flatMap((c) => c.args).join(' ')
    const decoded = calls
      .filter((c) => c.cmd === 'powershell')
      .map((c) => Buffer.from(c.args.at(-1) ?? '', 'base64').toString('utf16le'))
      .join('\n')
    for (const secret of ['s3cr3t!', 'chave-psk']) {
      expect(argv).not.toContain(secret)
      expect(decoded).not.toContain(secret)
    }
    expect(JSON.parse(calls[0].stdin ?? '{}')).toEqual({
      username: 'ana',
      password: 's3cr3t!',
      psk: 'chave-psk'
    })
    expect(calls[1]).toMatchObject({ cmd: 'rasdial', args: ['North ECOFITUS dAna'] })
    await driver.disconnect()
    expect(calls.at(-1)).toMatchObject({ args: ['North ECOFITUS dAna', '/disconnect'] })
  })

  it('maps rasdial errors to North error codes', async () => {
    expect(
      rasErrorCode({ code: 1, stdout: 'Remote Access error 691 - access denied', stderr: '' })
    ).toBe(691)
    expect(rasError(691, 'pptp').code).toBe('AUTH_FAILED')
    expect(rasError(800, 'pptp').code).toBe('GATEWAY_UNREACHABLE')
    expect(rasError(789, 'l2tp').message).toContain('pré-compartilhada')
    const driver = new WindowsNativeDriver({
      run: async (cmd) => (cmd === 'rasdial' ? { code: 691, stdout: '', stderr: '' } : ok()),
      routes: async () => []
    })
    await expect(driver.connect(context(config(), { password: 'x' }))).rejects.toMatchObject({
      code: 'AUTH_FAILED'
    })
  })

  it('asks for the password and the L2TP PSK before touching Windows', async () => {
    const run = vi.fn(async () => ok())
    const driver = new WindowsNativeDriver({ run, routes: async () => [] })
    await expect(driver.connect(context(config(), {}))).rejects.toMatchObject({
      code: 'SECRET_MISSING'
    })
    await expect(
      driver.connect(context(config({ protocol: 'l2tp' }), { password: 'x' }))
    ).rejects.toMatchObject({ code: 'SECRET_MISSING' })
    expect(run).not.toHaveBeenCalled()
  })

  it('reports a drop when the entry leaves rasdial’s active list', async () => {
    vi.useFakeTimers()
    let connected = true
    const driver = new WindowsNativeDriver({
      run: async (cmd, args) =>
        cmd === 'rasdial' && args.length === 0
          ? ok(connected ? 'Connected to\r\nNorth ECOFITUS dAna\r\n' : 'No connections\r\n')
          : ok(),
      routes: async () => [],
      pollMs: 1000
    })
    const dropped = vi.fn()
    driver.onDrop(dropped)
    await driver.connect(context(config(), { password: 'x' }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(dropped).not.toHaveBeenCalled()
    connected = false
    await vi.advanceTimersByTimeAsync(1000)
    expect(dropped).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
