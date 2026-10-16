import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { VpnProfile, VpnSecretKind } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DirectBroker, type PrivilegeBroker } from '../privilege-broker'
import { TunnelRegistry } from '../tunnel-registry'
import type { VpnError } from '../vpn-error'
import { cleanupOpenvpnOrphans, OpenVpnDriver } from './openvpn-driver'
import type { SecretResolver } from './vpn-driver'

const FAKE = resolve(__dirname, '../../../../../test/fixtures/fake-openvpn.mjs')

/** Runs the fake through node; argv is exactly what the driver passed. */
function fakeBroker(): PrivilegeBroker & { argv: string[][] } {
  const direct = new DirectBroker()
  const argv: string[][] = []
  return {
    argv,
    launch(_binary, args) {
      argv.push(args)
      return direct.launch(process.execPath, [FAKE, ...args])
    },
    kill: (pid) => direct.kill(pid)
  }
}

let workDir: string
let recordPath: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'north-vpn-test-'))
  recordPath = join(workDir, 'record.jsonl')
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

function profile(
  scenario: string,
  opts: { userPass?: boolean; encryptedKey?: boolean } = {}
): VpnProfile {
  const ovpn = [
    'client',
    'dev tun',
    'remote vpn.acme.com 1194',
    `# fake-scenario: ${scenario}`,
    `# fake-record: ${recordPath}`,
    ...(opts.userPass ? ['auth-user-pass'] : [])
  ].join('\n')
  return {
    id: '11111111-1111-4111-8111-111111111111',
    clientId: null,
    name: 'Acme',
    kind: 'openvpn',
    config: {
      kind: 'openvpn',
      ovpn,
      requiresUserPass: Boolean(opts.userPass),
      requiresKeyPassphrase: Boolean(opts.encryptedKey),
      username: opts.userPass ? 'alice' : undefined,
      remoteSummary: [{ host: 'vpn.acme.com', port: 1194, proto: 'udp' }],
      redirectGateway: false,
      declaredRoutes: []
    },
    autoDisconnect: 'when-idle',
    idleTimeoutSec: 300,
    notes: null,
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z'
  }
}

function secrets(
  values: Partial<Record<VpnSecretKind, string>>,
  inline: Record<string, string> = {}
): SecretResolver {
  return { get: (kind) => values[kind] ?? null, inlineBlocks: () => inline }
}

const ENCRYPTED_KEY =
  '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFAKE\n-----END ENCRYPTED PRIVATE KEY-----'

function makeDriver(broker = fakeBroker(), timeoutMs = 4000) {
  const tunnels = new TunnelRegistry(join(workDir, 'tunnels'))
  const driver = new OpenVpnDriver({
    binary: () => '/usr/sbin/openvpn',
    broker,
    tmpDir: join(workDir, 'tmp'),
    tunnels,
    handshakeTimeoutMs: timeoutMs
  })
  return { driver, broker, tunnels }
}

function tmpFiles(): string[] {
  const dir = join(workDir, 'tmp')
  return existsSync(dir) ? readdirSync(dir) : []
}

function recorded(): Array<{
  argv?: string[]
  env?: Record<string, string>
  cmd?: string
  config?: string
}> {
  if (!existsSync(recordPath)) return []
  return readFileSync(recordPath, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
}

const ctx = (p: VpnProfile, s: SecretResolver, log: string[] = []) => ({
  profile: p,
  secrets: s,
  log: (l: string) => log.push(l),
  signal: new AbortController().signal
})

describe('OpenVpnDriver (against fake openvpn)', () => {
  it('connects, sends credentials only via management, then disconnects cleanly', async () => {
    const { driver, broker, tunnels } = makeDriver()
    const p = profile('ok', { userPass: true, encryptedKey: true })
    const info = await driver.connect(
      ctx(p, secrets({ password: 'pw-ok', 'key-passphrase': 'key-ok' }, { key: ENCRYPTED_KEY }))
    )

    expect(info).toEqual({ localIp: '10.8.0.6', routes: ['10.20.0.0/16'], redirectGateway: false })

    // secrets never in argv / env / config file
    const [start] = recorded()
    const blob = JSON.stringify({ argv: broker.argv, env: start.env, config: start.config })
    expect(blob).not.toContain('pw-ok')
    expect(blob).not.toContain('key-ok')
    // but they did arrive over management
    const cmds = recorded().map((r) => r.cmd)
    expect(cmds).toContain('password "Auth" "pw-ok"')
    expect(cmds).toContain('username "Auth" "alice"')
    expect(cmds).toContain('password "Private Key" "key-ok"')
    // inline key re-injected into the temp config
    expect(start.config).toContain('<key>')
    // management is localhost-only with a password file, pw file already gone
    const argv = broker.argv[0]
    const m = argv.indexOf('--management')
    expect(argv[m + 1]).toBe('127.0.0.1')
    expect(argv).toContain('--management-query-passwords')
    expect(argv).toContain('--management-hold')
    expect(argv).toContain('--auth-nocache')
    expect(existsSync(argv[m + 3])).toBe(false)

    expect(tunnels.list()).toHaveLength(1)
    expect(tunnels.list()[0].pid).toBeGreaterThan(0)

    await driver.disconnect()
    expect(cmds.concat(recorded().map((r) => r.cmd))).toContain('signal SIGTERM')
    expect(tmpFiles()).toEqual([])
    expect(tunnels.list()).toEqual([])
  })

  it('wrong password → AUTH_FAILED and temp files removed', async () => {
    const { driver } = makeDriver()
    await expect(
      driver.connect(ctx(profile('ok', { userPass: true }), secrets({ password: 'nope' })))
    ).rejects.toMatchObject({ code: 'AUTH_FAILED' })
    expect(tmpFiles()).toEqual([])
  })

  it('wrong key passphrase → KEY_PASSPHRASE_WRONG', async () => {
    const { driver } = makeDriver()
    await expect(
      driver.connect(
        ctx(
          profile('ok', { encryptedKey: true }),
          secrets({ 'key-passphrase': 'bad' }, { key: ENCRYPTED_KEY })
        )
      )
    ).rejects.toMatchObject({ code: 'KEY_PASSPHRASE_WRONG' })
  })

  it('missing saved secret → SECRET_MISSING before spawning', async () => {
    const { driver, broker } = makeDriver()
    await expect(
      driver.connect(ctx(profile('ok', { userPass: true }), secrets({})))
    ).rejects.toMatchObject({ code: 'SECRET_MISSING' })
    expect(broker.argv).toEqual([])
  })

  it('no binary → BINARY_MISSING', async () => {
    const tunnels = new TunnelRegistry(join(workDir, 'tunnels'))
    const driver = new OpenVpnDriver({
      binary: () => null,
      broker: fakeBroker(),
      tmpDir: join(workDir, 'tmp'),
      tunnels
    })
    await expect(driver.connect(ctx(profile('ok'), secrets({})))).rejects.toMatchObject({
      code: 'BINARY_MISSING'
    })
  })

  it('handshake timeout → TIMEOUT and the process is stopped', async () => {
    const { driver } = makeDriver(fakeBroker(), 400)
    await expect(driver.connect(ctx(profile('slow'), secrets({})))).rejects.toMatchObject({
      code: 'TIMEOUT'
    })
    expect(tmpFiles()).toEqual([])
  })

  it('process dies during connect → DRIVER_CRASHED', async () => {
    const { driver } = makeDriver()
    const err = (await driver
      .connect(ctx(profile('crash'), secrets({})))
      .catch((e) => e)) as VpnError
    expect(err.code).toBe('DRIVER_CRASHED')
    expect(tmpFiles()).toEqual([])
  })

  it('process dies after connect → onDrop fires once and cleans up', async () => {
    const { driver, tunnels } = makeDriver()
    const drops: Array<Error | undefined> = []
    driver.onDrop((e) => drops.push(e))
    await driver.connect(ctx(profile('drop'), secrets({})))
    await new Promise((r) => setTimeout(r, 400))
    expect(drops).toHaveLength(1)
    expect(tmpFiles()).toEqual([])
    expect(tunnels.list()).toEqual([])
  })

  it('privilege denied by the broker surfaces as PRIVILEGE_DENIED', async () => {
    const { SudoPromptBroker } = await import('../privilege-broker')
    const broker = new SudoPromptBroker((_c, _o, cb) =>
      cb(new Error('User did not grant permission.'))
    )
    const { driver } = makeDriver(broker as unknown as ReturnType<typeof fakeBroker>)
    await expect(driver.connect(ctx(profile('ok'), secrets({})))).rejects.toMatchObject({
      code: 'PRIVILEGE_DENIED'
    })
    expect(tmpFiles()).toEqual([])
  })

  it('logs never contain the secrets', async () => {
    const { driver } = makeDriver()
    const log: string[] = []
    await driver.connect(
      ctx(profile('ok', { userPass: true }), secrets({ password: 'pw-ok' }), log)
    )
    await driver.disconnect()
    expect(log.join('\n')).not.toContain('pw-ok')
    expect(log.length).toBeGreaterThan(0)
  })
})

describe('cleanupOpenvpnOrphans', () => {
  it('stops a tunnel left behind via its management port and clears the tmp dir', async () => {
    const { driver, tunnels } = makeDriver()
    await driver.connect(ctx(profile('ok'), secrets({})))
    const [record] = tunnels.list()
    // simulate a North crash: forget the driver, keep the process + record
    const broker = fakeBroker()
    await cleanupOpenvpnOrphans({ tunnels, broker, tmpDir: join(workDir, 'tmp') })
    await new Promise((r) => setTimeout(r, 100))
    expect(recorded().map((r) => r.cmd)).toContain('signal SIGTERM')
    expect(tunnels.list()).toEqual([])
    expect(tmpFiles()).toEqual([])
    expect(() => process.kill(record.pid as number, 0)).toThrow()
  })
})
