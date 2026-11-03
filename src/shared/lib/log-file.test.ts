import { describe, expect, it } from 'vitest'
import { ConnectionSchema, CreateConnectionInputSchema } from '../types/connection'
import { ByteRing } from './byte-ring'
import {
  absoluteLogPath,
  buildTailFollowCommand,
  LOG_FOLLOW_RING_BYTES,
  normalizeLogFileList,
  normalizeLogFilePath,
  sanitizeLogStderr
} from './log-file'

const FILE_ID = '11111111-1111-4111-8111-111111111111'
const FILE_ID_2 = '22222222-2222-4222-8222-222222222222'

const createBase = {
  groupId: '33333333-3333-4333-8333-333333333333',
  name: 'box',
  protocol: 'ssh' as const,
  host: 'h',
  port: 22,
  authMethod: 'password' as const
}

describe('normalizeLogFilePath', () => {
  it('accepts an absolute path and a home-relative path', () => {
    expect(normalizeLogFilePath(' /var/log/app.log/ ')).toEqual({
      ok: true,
      value: '/var/log/app.log'
    })
    expect(normalizeLogFilePath('~/app/app.log')).toEqual({ ok: true, value: '~/app/app.log' })
  })

  it('rejects a relative path, ~other and a blank value', () => {
    expect(normalizeLogFilePath('var/log/app.log').ok).toBe(false)
    expect(normalizeLogFilePath('~other/app.log').ok).toBe(false)
    expect(normalizeLogFilePath('  ').ok).toBe(false)
    expect(normalizeLogFilePath('/tmp/a\nb').ok).toBe(false)
  })
})

describe('normalizeLogFileList', () => {
  it('trims the label away when it is blank and keeps the path text', () => {
    const result = normalizeLogFileList([{ id: FILE_ID, path: '~/app/app.log', label: '  ' }])
    expect(result).toEqual({
      ok: true,
      value: [{ id: FILE_ID, path: '~/app/app.log', label: null }]
    })
  })

  it('rejects a duplicate path and a label with a newline', () => {
    expect(
      normalizeLogFileList([
        { id: FILE_ID, path: '/var/log/app.log', label: null },
        { id: FILE_ID_2, path: '/var/log/app.log/', label: null }
      ])
    ).toMatchObject({ ok: false, reason: 'duplicate', index: 1 })
    expect(
      normalizeLogFileList([{ id: FILE_ID, path: '/var/log/app.log', label: 'a\nb' }])
    ).toMatchObject({ ok: false, reason: 'invalid-label' })
  })
})

describe('buildTailFollowCommand', () => {
  it('quotes the path and follows by name', () => {
    expect(buildTailFollowCommand('/var/log/my app.log')).toBe(
      "tail -n 200 -F -- '/var/log/my app.log'"
    )
    expect(buildTailFollowCommand("/tmp/a'b")).toBe(`tail -n 200 -F -- '/tmp/a'\\''b'`)
    expect(buildTailFollowCommand('/tmp/a; rm')).toBe("tail -n 200 -F -- '/tmp/a; rm'")
  })
})

describe('absoluteLogPath', () => {
  it('resolves ~ against the login directory and leaves an absolute path alone', () => {
    expect(absoluteLogPath('~/app/app.log', '/home/u')).toBe('/home/u/app/app.log')
    expect(absoluteLogPath('/var/log/app.log', null)).toBe('/var/log/app.log')
    expect(absoluteLogPath('~/app/app.log', null)).toBeNull()
  })
})

describe('sanitizeLogStderr', () => {
  it('drops control bytes other than tab and newlines and cuts a long line', () => {
    const raw = Uint8Array.from([0x1b, 0x5b, 0x33, 0x31, 0x6d, 0x41, 0x0a])
    expect(Array.from(sanitizeLogStderr(raw))).toEqual([0x5b, 0x33, 0x31, 0x6d, 0x41, 0x0a])
    const long = new Uint8Array(600).fill(0x41)
    expect(sanitizeLogStderr(long).byteLength).toBe(500)
  })
})

describe('ByteRing', () => {
  it('drops the oldest bytes past the cap', () => {
    const ring = new ByteRing(4)
    ring.push(Uint8Array.from([1, 2, 3]))
    ring.push(Uint8Array.from([4, 5]))
    expect(Array.from(ring.snapshot())).toEqual([2, 3, 4, 5])
  })

  it('uses the follow cap of 256 KiB', () => {
    expect(LOG_FOLLOW_RING_BYTES).toBe(256 * 1024)
  })
})

describe('logFiles on the connection schema', () => {
  it('defaults a missing list and rejects a relative path', () => {
    expect(CreateConnectionInputSchema.parse(createBase).logFiles).toBeUndefined()
    const parsed = CreateConnectionInputSchema.parse({
      ...createBase,
      logFiles: [{ id: FILE_ID, path: ' ~/app/app.log/ ', label: 'api' }]
    })
    expect(parsed.logFiles).toEqual([{ id: FILE_ID, path: '~/app/app.log', label: 'api' }])
    expect(() =>
      CreateConnectionInputSchema.parse({
        ...createBase,
        logFiles: [{ id: FILE_ID, path: 'var/log/app.log', label: null }]
      })
    ).toThrow()
  })

  it('defaults logFiles when an older connection payload omits them', () => {
    const parsed = ConnectionSchema.parse({
      id: FILE_ID,
      groupId: FILE_ID_2,
      name: 'box',
      description: null,
      protocol: 'ssh',
      host: 'h',
      port: 22,
      username: null,
      authMethod: 'password',
      credentialRef: null,
      privateKeyPath: null,
      agentForward: false,
      jumpHostId: null,
      defaultCommand: null,
      notes: null,
      os: null,
      icon: null,
      color: null,
      owner: null,
      links: [],
      vpnRequired: false,
      vpnMode: 'inherit',
      vpnProfileId: null,
      checklist: [],
      relatedFiles: [],
      isFavorite: false,
      accessCount: 0,
      totalConnectedMs: 0,
      lastConnectedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(parsed.logFiles).toEqual([])
  })
})
