import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { VpnProfile } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildElevatedCommand, DirectBroker, type PrivilegeBroker } from '../privilege-broker'
import { cleanupFortiOrphans, OpenfortivpnDriver } from './openfortivpn-driver'
import type { SecretResolver } from './vpn-driver'

const FAKE = resolve(__dirname, '../../../../../test/fixtures/fake-openfortivpn.mjs')
const DIGEST = 'a'.repeat(64)

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'north-forti-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function recordingBroker(): PrivilegeBroker & { calls: Array<{ binary: string; args: string[] }> } {
  const direct = new DirectBroker()
  const calls: Array<{ binary: string; args: string[] }> = []
  return {
    calls,
    launch(binary, args) {
      calls.push({ binary, args })
      // same validation the real (sudo-prompt) broker applies before elevating
      buildElevatedCommand(binary, args)
      return direct.launch(binary, args)
    },
    kill: (pid) => direct.kill(pid)
  }
}

const profile = (username: string, trustedCert?: string): VpnProfile => ({
  id: '22222222-2222-4222-8222-222222222222',
  clientId: null,
  name: 'PAC',
  kind: 'fortinet-sslvpn',
  config: {
    kind: 'fortinet-sslvpn',
    gateway: '179.190.99.2',
    port: 4433,
    username,
    ...(trustedCert ? { trustedCert } : {})
  },
  autoDisconnect: 'when-idle',
  idleTimeoutSec: 300,
  notes: null,
  createdAt: '2026-10-16T00:00:00.000Z',
  updatedAt: '2026-10-16T00:00:00.000Z'
})

const secrets = (password: string | null): SecretResolver => ({
  get: (k) => (k === 'password' ? password : null),
  inlineBlocks: () => ({})
})

function make(broker = recordingBroker(), handshakeTimeoutMs = 5000) {
  const driver = new OpenfortivpnDriver({
    binary: () => FAKE,
    broker,
    tmpDir: join(dir, 'tmp'),
    handshakeTimeoutMs,
    pollMs: 20
  })
  return { driver, broker }
}

const ctx = (p: VpnProfile, s: SecretResolver, log: string[] = []) => ({
  profile: p,
  secrets: s,
  log: (l: string) => log.push(l),
  signal: new AbortController().signal
})

const tmpFiles = () => (existsSync(join(dir, 'tmp')) ? readdirSync(join(dir, 'tmp')) : [])

describe('OpenfortivpnDriver (against fake openfortivpn)', () => {
  it('connects, reports the IP, keeps the password out of argv, and stops without a second prompt', async () => {
    const { driver, broker } = make()
    const log: string[] = []
    const info = await driver.connect(ctx(profile('ok', DIGEST), secrets('pw-ok'), log))
    expect(info).toEqual({ localIp: '10.212.134.200', routes: [], redirectGateway: false })
    expect(JSON.stringify(broker.calls)).not.toContain('pw-ok')
    expect(broker.calls[0].binary).toBe('/bin/sh')
    // the config file with the password is gone as soon as the tunnel is up
    expect(tmpFiles().some((f) => f.endsWith('.cfg'))).toBe(false)
    expect(log.join('\n')).toContain('Tunnel is up')

    await driver.disconnect()
    expect(broker.calls).toHaveLength(1)
    expect(tmpFiles()).toEqual([])
  })

  it('a gateway saved as "host:port" is split before connecting (the bug seen with PAC)', async () => {
    const { driver } = make()
    const p = profile('ok', DIGEST)
    if (p.config.kind !== 'fortinet-sslvpn') throw new Error('kind')
    p.config = { ...p.config, gateway: '179.190.99.2:4433', port: 443 }
    await expect(driver.connect(ctx(p, secrets('pw-ok')))).resolves.toMatchObject({
      localIp: '10.212.134.200'
    })
    await driver.disconnect()
  })

  it('unreachable gateway → GATEWAY_UNREACHABLE with host:port, not the wrapper command', async () => {
    const { driver } = make()
    const err = await driver
      .connect(ctx(profile('refused', DIGEST), secrets('pw-ok')))
      .catch((e) => e)
    expect(err.code).toBe('GATEWAY_UNREACHABLE')
    expect(err.message).toContain('179.190.99.2:4433')
    expect(err.message).not.toContain('/bin/sh')
  })

  it('wrong password → AUTH_FAILED, files cleaned', async () => {
    const { driver } = make()
    await expect(driver.connect(ctx(profile('ok', DIGEST), secrets('nope')))).rejects.toMatchObject(
      {
        code: 'AUTH_FAILED'
      }
    )
    expect(tmpFiles()).toEqual([])
  })

  it('self-signed gateway → CERT_UNTRUSTED carrying the digest to confirm', async () => {
    const { driver } = make()
    const err = await driver.connect(ctx(profile('cert'), secrets('pw-ok'))).catch((e) => e)
    expect(err.code).toBe('CERT_UNTRUSTED')
    expect(err.certDigest).toBe(DIGEST)
  })

  it('a trusted digest that no longer matches says the certificate CHANGED', async () => {
    const { driver } = make()
    const err = await driver
      .connect(ctx(profile('cert', 'b'.repeat(64)), secrets('pw-ok')))
      .catch((e) => e)
    expect(err.code).toBe('CERT_UNTRUSTED')
    expect(err.message).toMatch(/mudou/i)
  })

  it('missing password → SECRET_MISSING before spawning', async () => {
    const { driver, broker } = make()
    await expect(driver.connect(ctx(profile('ok', DIGEST), secrets(null)))).rejects.toMatchObject({
      code: 'SECRET_MISSING'
    })
    expect(broker.calls).toEqual([])
  })

  it('no binary → BINARY_MISSING with install hint', async () => {
    const driver = new OpenfortivpnDriver({
      binary: () => null,
      broker: recordingBroker(),
      tmpDir: join(dir, 'tmp')
    })
    await expect(driver.connect(ctx(profile('ok'), secrets('pw-ok')))).rejects.toMatchObject({
      code: 'BINARY_MISSING',
      message: expect.stringContaining('openfortivpn')
    })
  })

  it('stuck → TIMEOUT and the process is stopped', async () => {
    const { driver } = make(recordingBroker(), 300)
    await expect(
      driver.connect(ctx(profile('slow', DIGEST), secrets('pw-ok')))
    ).rejects.toMatchObject({
      code: 'TIMEOUT'
    })
    expect(tmpFiles()).toEqual([])
  })

  it('tunnel drops → onDrop once', async () => {
    const { driver } = make()
    const drops: unknown[] = []
    driver.onDrop((e) => drops.push(e))
    await driver.connect(ctx(profile('drop', DIGEST), secrets('pw-ok')))
    await new Promise((r) => setTimeout(r, 2500))
    expect(drops).toHaveLength(1)
  }, 10_000)

  it('orphan cleanup stops a tunnel left by a crashed North', async () => {
    const { driver } = make()
    await driver.connect(ctx(profile('ok', DIGEST), secrets('pw-ok')))
    await cleanupFortiOrphans(join(dir, 'tmp'), 3000)
    expect(tmpFiles().filter((f) => f.endsWith('.log'))).toEqual([])
  }, 10_000)
})
