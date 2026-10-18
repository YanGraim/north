import { spawn } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OpenfortivpnDriver } from './drivers/openfortivpn-driver'
import { StrongswanDriver } from './drivers/strongswan-driver'
import { buildElevatedCommand, type PrivilegeBroker } from './privilege-broker'
import {
  buildHelperInstall,
  type HelperFs,
  type HelperSpawn,
  helperStatus,
  SUDOERS_FILE,
  VpnHelper
} from './vpn-helper'

const ROOT = resolve(__dirname, '../../../..')
const HELPER = join(ROOT, 'resources/vpn/north-vpn-helper')
const FAKE = join(ROOT, 'test/fixtures/fake-openfortivpn.mjs')
const FAKE_CHARON = join(ROOT, 'test/fixtures/fake-charon-cmd.mjs')
const DIR = '/Library/PrivilegedHelperTools/app.north.vpn'

function memFs(files: Record<string, { content?: string; uid?: number; mode?: number }>): HelperFs {
  return {
    read: (p) => files[p]?.content ?? null,
    stat: (p) => (files[p] ? { uid: files[p].uid ?? 0, mode: files[p].mode ?? 0o755 } : null)
  }
}

const installedFs = (
  over: Record<string, { content?: string; uid?: number; mode?: number }> = {}
) =>
  memFs({
    '/src/helper': { content: 'v1' },
    [DIR]: {},
    [`${DIR}/north-vpn-helper`]: { content: 'v1' },
    [`${DIR}/openfortivpn`]: {},
    [SUDOERS_FILE]: { mode: 0o440 },
    ...over
  })

const platform = (fs: HelperFs) => ({
  platform: 'darwin' as const,
  source: '/src/helper',
  user: 'yan',
  fs
})

describe('helperStatus', () => {
  it('installed when root-owned, identical to the bundled one and sudoers present', () => {
    expect(helperStatus(platform(installedFs()), { forti: true })).toBe('installed')
  })
  it('missing without the helper or the sudoers rule', () => {
    expect(helperStatus(platform(memFs({ '/src/helper': { content: 'v1' } })))).toBe('missing')
    expect(helperStatus(platform(installedFs({ [SUDOERS_FILE]: undefined as never })))).toBe(
      'missing'
    )
  })
  it('outdated when the bundled helper changed (app update)', () => {
    expect(helperStatus(platform(installedFs({ '/src/helper': { content: 'v2' } })))).toBe(
      'outdated'
    )
  })
  it('never trusts a helper the user could have written', () => {
    expect(
      helperStatus(
        platform(installedFs({ [`${DIR}/north-vpn-helper`]: { content: 'v1', uid: 501 } }))
      )
    ).toBe('outdated')
    expect(
      helperStatus(
        platform(installedFs({ [`${DIR}/north-vpn-helper`]: { content: 'v1', mode: 0o777 } }))
      )
    ).toBe('outdated')
  })
  it('outdated when SSL-VPN needs openfortivpn and the copy is missing', () => {
    expect(
      helperStatus(platform(installedFs({ [`${DIR}/openfortivpn`]: undefined as never })), {
        forti: true
      })
    ).toBe('outdated')
  })
  it('unsupported on Windows', () => {
    expect(helperStatus({ ...platform(installedFs()), platform: 'win32' })).toBe('unsupported')
  })
})

describe('buildHelperInstall', () => {
  it('is a single elevatable command naming the user and the binary to copy', () => {
    const { binary, args } = buildHelperInstall(
      platform(installedFs()),
      '/opt/homebrew/bin/openfortivpn'
    )
    const command = buildElevatedCommand(binary, args)
    expect(command).not.toMatch(/[\r\n]/)
    expect(args.slice(3)).toEqual(['/src/helper', DIR, 'yan', '/opt/homebrew/bin/openfortivpn', ''])
    expect(args[1]).toContain('visudo -cf')
  })
  it('rejects a user name that could inject into sudoers', () => {
    expect(() =>
      buildHelperInstall({ ...platform(installedFs()), user: 'yan ALL=(ALL) NOPASSWD: ALL' }, null)
    ).toThrow()
  })
})

describe('VpnHelper.ensure', () => {
  it('prompts once to install, then never again', async () => {
    const files: Record<string, { content?: string }> = { '/src/helper': { content: 'v1' } }
    const fs = memFs(files)
    const launches: string[][] = []
    const broker: PrivilegeBroker = {
      launch(_binary, args) {
        launches.push(args)
        Object.assign(files, {
          [DIR]: {},
          [`${DIR}/north-vpn-helper`]: { content: 'v1' },
          [`${DIR}/openfortivpn`]: {},
          [SUDOERS_FILE]: {}
        })
        return { exited: Promise.resolve({ code: 0 }) }
      },
      kill: async () => {}
    }
    const helper = new VpnHelper({ ...platform(fs), broker, fortiBinary: () => '/x/openfortivpn' })
    await helper.ensure({ forti: true })
    await helper.ensure({ forti: true })
    expect(launches).toHaveLength(1)
  })
})

/** Runs the real helper script (without sudo) next to a fake openfortivpn. */
describe.runIf(process.platform !== 'win32')('north-vpn-helper script', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'north-helper-'))
    copyFileSync(HELPER, join(dir, 'north-vpn-helper'))
    // the helper pins PATH, so the fake can't rely on `env node`
    writeFileSync(
      join(dir, 'openfortivpn'),
      `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`,
      { mode: 0o755 }
    )
    writeFileSync(
      join(dir, 'charon-cmd'),
      `#!/bin/sh\nexec "${process.execPath}" "${FAKE_CHARON}" "$@"\n`,
      { mode: 0o755 }
    )
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const directSpawn: HelperSpawn = (command, args, input, onOutput) => {
    const child = spawn('/bin/sh', [command, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
    child.stdout.on('data', onOutput)
    child.stderr.on('data', onOutput)
    child.stdin.end(input)
    return {
      exited: new Promise((done) => child.once('exit', (code) => done({ code }))),
      stop: () => child.kill('SIGTERM')
    }
  }

  const run = (input: string) =>
    new Promise<{ code: number | null; out: string }>((done) => {
      let out = ''
      const r = directSpawn(join(dir, 'north-vpn-helper'), ['forti'], input, (c) => {
        out += c
      })
      void r.exited.then(({ code }) => done({ code, out }))
    })

  it('refuses any option outside the whitelist (pppd-plugin would run code as root)', async () => {
    const { code, out } = await run(
      'host = h\nport = 443\nusername = ok\npassword = pw-ok\npppd-plugin = /tmp/evil.so\n'
    )
    expect(code).toBe(64)
    expect(out).toContain('not allowed')
  })

  it('drives a full SSL-VPN connect/disconnect through the driver with no prompt', async () => {
    const helper = {
      ensure: async () => {},
      startForti: (config: string, onOutput: (c: Buffer) => void) =>
        directSpawn(join(dir, 'north-vpn-helper'), ['forti'], config, onOutput)
    }
    const broker: PrivilegeBroker = {
      launch: () => {
        throw new Error('must not prompt')
      },
      kill: async () => {}
    }
    const driver = new OpenfortivpnDriver({
      binary: () => FAKE,
      broker,
      helper,
      tmpDir: join(dir, 'tmp'),
      pollMs: 20
    })
    const info = await driver.connect({
      profile: {
        id: '44444444-4444-4444-8444-444444444444',
        clientId: null,
        name: 'PAC',
        kind: 'fortinet-sslvpn',
        config: {
          kind: 'fortinet-sslvpn',
          gateway: '179.190.99.2',
          port: 4433,
          username: 'ok',
          trustedCert: 'a'.repeat(64)
        },
        autoDisconnect: 'when-idle',
        idleTimeoutSec: 300,
        notes: null,
        createdAt: '2026-10-17T00:00:00.000Z',
        updatedAt: '2026-10-17T00:00:00.000Z'
      },
      secrets: { get: () => 'pw-ok', inlineBlocks: () => ({}) },
      log: () => {},
      signal: new AbortController().signal
    })
    expect(info.localIp).toBe('10.212.134.200')
    await driver.disconnect()
    expect(readFileSync(HELPER, 'utf8')).toContain('north-vpn-helper v2')
  }, 15_000)

  const ipsecProfile = (username: string) => ({
    id: '55555555-5555-4555-8555-555555555555',
    clientId: null,
    name: 'POLY',
    kind: 'ipsec-ikev1' as const,
    config: {
      kind: 'ipsec-ikev1' as const,
      gateway: 'poly.fortidyndns.com',
      username,
      xauth: 'saved' as const
    },
    autoDisconnect: 'when-idle' as const,
    idleTimeoutSec: 300,
    notes: null,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z'
  })
  const ipsecDriver = (timeout = 5000) =>
    new StrongswanDriver({
      binary: () => FAKE_CHARON,
      handshakeTimeoutMs: timeout,
      helper: {
        ensure: async () => {},
        startIpsec: (input, onOutput) =>
          directSpawn(join(dir, 'north-vpn-helper'), ['ipsec'], input, onOutput)
      }
    })
  const ipsecCtx = (username: string, psk = 'psk-ok') => ({
    profile: ipsecProfile(username),
    secrets: {
      get: (k: string) => (k === 'psk' ? psk : 'pw-ok'),
      inlineBlocks: () => ({})
    },
    log: () => {},
    signal: new AbortController().signal
  })

  it('IPsec: connects through the helper (PSK + XAuth over stdin) and stops on disconnect', async () => {
    const driver = ipsecDriver()
    const info = await driver.connect(ipsecCtx('ok'))
    expect(info.localIp).toBe('10.10.20.5')
    await driver.disconnect()
  }, 15_000)

  it('IPsec: wrong PSK → AUTH_FAILED', async () => {
    const err = await ipsecDriver()
      .connect(ipsecCtx('ok', 'wrong'))
      .catch((e) => e)
    expect(err.code).toBe('AUTH_FAILED')
  }, 15_000)

  it('IPsec: proposals rejected → CONNECTION_REJECTED', async () => {
    const err = await ipsecDriver()
      .connect(ipsecCtx('proposal'))
      .catch((e) => e)
    expect(err.code).toBe('CONNECTION_REJECTED')
  }, 15_000)

  it('IPsec: gateway never answers → GATEWAY_UNREACHABLE', async () => {
    const err = await ipsecDriver()
      .connect(ipsecCtx('unreachable'))
      .catch((e) => e)
    expect(err.code).toBe('GATEWAY_UNREACHABLE')
  }, 15_000)

  it('IPsec helper refuses option smuggling as root', async () => {
    const { code, out } = await new Promise<{ code: number | null; out: string }>((done) => {
      let out = ''
      const r = directSpawn(
        join(dir, 'north-vpn-helper'),
        ['ipsec'],
        'host=--debug\nuser=x\npsk=a\npassword=b\nike=aes128-sha1-modp1536\nesp=aes128-sha1\n',
        (c) => {
          out += c
        }
      )
      void r.exited.then(({ code }) => done({ code, out }))
    })
    expect(code).toBe(64)
    expect(out).toContain('invalid value')
  })
})
