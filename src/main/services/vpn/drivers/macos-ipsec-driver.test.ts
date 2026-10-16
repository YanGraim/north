import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { VpnProfile, VpnSecretKind } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MacosIpsecDriver, type RunCommand } from './macos-ipsec-driver'
import type { SecretResolver } from './vpn-driver'

const ID = '0F6A5C3E-1111-4222-8333-944455556666'
const LIST_EMPTY = 'Available network connection services in the current set (*=enabled):\n'
const LIST_WITH = (status: string) =>
  `${LIST_EMPTY}* (${status})   ${ID} IPSec              "North · POLY"     [IPSec]\n`
const STATUS = (s: string, extra = '') =>
  `${s}\nExtended Status <dictionary> {\n${extra}  Status : 0\n}\n`
const CONNECTED = STATUS(
  'Connected',
  '  IPv4 : <dictionary> {\n    Addresses : <array> {\n      0 : 10.212.134.5\n    }\n  }\n'
)

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'north-ipsec-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const profile: VpnProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  clientId: null,
  name: 'POLY',
  kind: 'ipsec-ikev1',
  config: { kind: 'ipsec-ikev1', gateway: 'poly.fortiddns.com', username: 'yan', xauth: 'saved' },
  autoDisconnect: 'when-idle',
  idleTimeoutSec: 300,
  notes: null,
  createdAt: '2026-10-16T00:00:00.000Z',
  updatedAt: '2026-10-16T00:00:00.000Z'
}

const secrets = (v: Partial<Record<VpnSecretKind, string>>): SecretResolver => ({
  get: (k) => v[k] ?? null,
  inlineBlocks: () => ({})
})

/** Scripted fake of `scutil`/`open`: each call pops the next scripted output for that command. */
function fakeRun(script: { list: string[]; status?: string[]; startCode?: number }) {
  const calls: Array<{ cmd: string; args: string[] }> = []
  const lists = [...script.list]
  const statuses = [...(script.status ?? [])]
  const run: RunCommand = async (cmd, args) => {
    calls.push({ cmd, args })
    if (cmd === 'scutil' && args[1] === 'list') {
      return {
        code: 0,
        stdout: lists.length > 1 ? (lists.shift() as string) : lists[0],
        stderr: ''
      }
    }
    if (cmd === 'scutil' && args[1] === 'status') {
      return {
        code: 0,
        stdout: statuses.length > 1 ? (statuses.shift() as string) : (statuses[0] ?? ''),
        stderr: ''
      }
    }
    if (cmd === 'scutil' && args[1] === 'start') {
      return {
        code: script.startCode ?? 0,
        stdout: '',
        stderr: script.startCode ? 'No service' : ''
      }
    }
    return { code: 0, stdout: '', stderr: '' }
  }
  return { run, calls }
}

function driver(run: RunCommand, over: Record<string, number> = {}) {
  return new MacosIpsecDriver({
    run,
    tmpDir: join(dir, 'tmp'),
    installedFile: join(dir, 'ipsec-installed.json'),
    pollMs: 1,
    approvalTimeoutMs: 200,
    connectTimeoutMs: 200,
    watchMs: 5,
    ...over
  })
}

const ctx = (s: SecretResolver, progress: string[] = [], log: string[] = []) => ({
  profile,
  secrets: s,
  log: (l: string) => log.push(l),
  progress: (d: string) => progress.push(d),
  signal: new AbortController().signal
})

describe('MacosIpsecDriver', () => {
  it('first connect: opens the profile for approval, waits for the service, then starts it', async () => {
    const { run, calls } = fakeRun({
      list: [LIST_EMPTY, LIST_EMPTY, LIST_WITH('Disconnected')],
      status: [STATUS('Connecting'), CONNECTED]
    })
    const progress: string[] = []
    const d = driver(run)
    const info = await d.connect(ctx(secrets({ psk: 'k', password: 'p' }), progress))

    expect(info).toEqual({ localIp: '10.212.134.5', routes: [], redirectGateway: false })
    const opened = calls.filter((c) => c.cmd === 'open').map((c) => c.args[0])
    expect(opened[0]).toMatch(/\.mobileconfig$/)
    expect(opened[1]).toContain('x-apple.systempreferences')
    expect(progress.join(' ')).toMatch(/Ajustes do Sistema/)
    expect(calls).toContainEqual({ cmd: 'scutil', args: ['--nc', 'start', ID] })
    // secrets never in argv
    expect(JSON.stringify(calls)).not.toMatch(/"k"|"p"/)
    // temp profile removed after install
    expect(readdirSync(join(dir, 'tmp'))).toEqual([])
    await d.disconnect()
    expect(calls).toContainEqual({ cmd: 'scutil', args: ['--nc', 'stop', ID] })
  })

  it('already installed with the same config → no profile prompt, just start', async () => {
    const first = fakeRun({ list: [LIST_EMPTY, LIST_WITH('Disconnected')], status: [CONNECTED] })
    await driver(first.run).connect(ctx(secrets({ psk: 'k', password: 'p' })))
    const second = fakeRun({ list: [LIST_WITH('Disconnected')], status: [CONNECTED] })
    await driver(second.run).connect(ctx(secrets({ psk: 'k', password: 'p' })))
    expect(second.calls.some((c) => c.cmd === 'open')).toBe(false)
  })

  it('changed password with existing service → reopen profile and ask to approve, then proceed on next click', async () => {
    const first = fakeRun({ list: [LIST_EMPTY, LIST_WITH('Disconnected')], status: [CONNECTED] })
    await driver(first.run).connect(ctx(secrets({ psk: 'k', password: 'p' })))

    const changed = fakeRun({ list: [LIST_WITH('Disconnected')], status: [CONNECTED] })
    await expect(
      driver(changed.run).connect(ctx(secrets({ psk: 'k', password: 'NEW' })))
    ).rejects.toMatchObject({ code: 'PROFILE_APPROVAL_REQUIRED' })
    expect(changed.calls.some((c) => c.cmd === 'open')).toBe(true)

    const after = fakeRun({ list: [LIST_WITH('Disconnected')], status: [CONNECTED] })
    await expect(
      driver(after.run).connect(ctx(secrets({ psk: 'k', password: 'NEW' })))
    ).resolves.toMatchObject({
      localIp: '10.212.134.5'
    })
    expect(after.calls.some((c) => c.cmd === 'open')).toBe(false)
  })

  it('profile never approved → PROFILE_APPROVAL_REQUIRED after the wait, temp file gone', async () => {
    const { run } = fakeRun({ list: [LIST_EMPTY] })
    await expect(
      driver(run).connect(ctx(secrets({ psk: 'k', password: 'p' })))
    ).rejects.toMatchObject({
      code: 'PROFILE_APPROVAL_REQUIRED'
    })
    expect(readdirSync(join(dir, 'tmp'))).toEqual([])
  })

  it('missing PSK or XAuth password → SECRET_MISSING before touching the system', async () => {
    const { run, calls } = fakeRun({ list: [LIST_EMPTY] })
    await expect(driver(run).connect(ctx(secrets({ password: 'p' })))).rejects.toMatchObject({
      code: 'SECRET_MISSING'
    })
    await expect(driver(run).connect(ctx(secrets({ psk: 'k' })))).rejects.toMatchObject({
      code: 'SECRET_MISSING'
    })
    expect(calls).toEqual([])
  })

  it('server rejects (back to Disconnected with LastCause) → CONNECTION_REJECTED', async () => {
    const { run } = fakeRun({
      list: [LIST_WITH('Disconnected')],
      status: [
        STATUS('Connecting'),
        STATUS('Disconnected', '  IPSec : <dictionary> {\n    LastCause : 14\n  }\n')
      ]
    })
    const installed = fakeRun({
      list: [LIST_EMPTY, LIST_WITH('Disconnected')],
      status: [CONNECTED]
    })
    await driver(installed.run).connect(ctx(secrets({ psk: 'k', password: 'p' })))
    const err = await driver(run)
      .connect(ctx(secrets({ psk: 'k', password: 'p' })))
      .catch((e) => e)
    expect(err.code).toBe('CONNECTION_REJECTED')
    expect(err.message).toContain('14')
  })

  it('stuck connecting → TIMEOUT and the service is stopped', async () => {
    const installed = fakeRun({
      list: [LIST_EMPTY, LIST_WITH('Disconnected')],
      status: [CONNECTED]
    })
    await driver(installed.run).connect(ctx(secrets({ psk: 'k', password: 'p' })))
    const { run, calls } = fakeRun({
      list: [LIST_WITH('Disconnected')],
      status: [STATUS('Connecting')]
    })
    await expect(
      driver(run).connect(ctx(secrets({ psk: 'k', password: 'p' })))
    ).rejects.toMatchObject({
      code: 'TIMEOUT'
    })
    expect(calls).toContainEqual({ cmd: 'scutil', args: ['--nc', 'stop', ID] })
  })

  it('tunnel drops after connect → onDrop', async () => {
    const installed = fakeRun({
      list: [LIST_EMPTY, LIST_WITH('Disconnected')],
      status: [CONNECTED]
    })
    await driver(installed.run).connect(ctx(secrets({ psk: 'k', password: 'p' })))
    const { run } = fakeRun({
      list: [LIST_WITH('Disconnected')],
      status: [CONNECTED, STATUS('Disconnected')]
    })
    const d = driver(run)
    const drops: unknown[] = []
    d.onDrop((e) => drops.push(e))
    await d.connect(ctx(secrets({ psk: 'k', password: 'p' })))
    await new Promise((r) => setTimeout(r, 50))
    expect(drops).toHaveLength(1)
  })

  it('xauth "prompt" omits the password from the profile (macOS asks on connect)', async () => {
    const { run, calls } = fakeRun({
      list: [LIST_EMPTY, LIST_WITH('Disconnected')],
      status: [CONNECTED]
    })
    let written = ''
    const wrapped: RunCommand = async (cmd, args) => {
      if (cmd === 'open' && args[0].endsWith('.mobileconfig') && existsSync(args[0])) {
        written = readFileSync(args[0], 'utf8')
      }
      return run(cmd, args)
    }
    const p = { ...profile, config: { ...profile.config, xauth: 'prompt' as const } }
    await driver(wrapped).connect({ ...ctx(secrets({ psk: 'k' })), profile: p })
    expect(written).not.toContain('XAuthPassword')
    expect(calls.length).toBeGreaterThan(0)
  })
})
