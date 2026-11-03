import { describe, expect, it } from 'vitest'
import { ConnectionSchema, CreateConnectionInputSchema } from '../types/connection'
import {
  canonicalPosixDir,
  normalizeStartupDirectory,
  planStartupDirectory,
  quotePosixArg,
  resolveStartupDirectory,
  startupCdCommand,
  startupCdCommandFromHome
} from './startup-directory'

const createBase = {
  groupId: '11111111-1111-4111-8111-111111111111',
  name: 'box',
  protocol: 'ssh' as const,
  host: 'h',
  port: 22,
  authMethod: 'password' as const
}

describe('normalizeStartupDirectory', () => {
  it('turns blank into null', () => {
    expect(normalizeStartupDirectory(null)).toEqual({ ok: true, value: null })
    expect(normalizeStartupDirectory(undefined)).toEqual({ ok: true, value: null })
    expect(normalizeStartupDirectory('')).toEqual({ ok: true, value: null })
    expect(normalizeStartupDirectory('   ')).toEqual({ ok: true, value: null })
  })

  it('keeps absolute paths and ~/ paths, stripping trailing slashes', () => {
    expect(normalizeStartupDirectory('  /var/www  ')).toEqual({ ok: true, value: '/var/www' })
    expect(normalizeStartupDirectory('/var/www/')).toEqual({ ok: true, value: '/var/www' })
    expect(normalizeStartupDirectory('/')).toEqual({ ok: true, value: '/' })
    expect(normalizeStartupDirectory('~')).toEqual({ ok: true, value: '~' })
    expect(normalizeStartupDirectory('~/')).toEqual({ ok: true, value: '~' })
    expect(normalizeStartupDirectory('~/app/')).toEqual({ ok: true, value: '~/app' })
    expect(normalizeStartupDirectory("~/it's a dir")).toEqual({ ok: true, value: "~/it's a dir" })
  })

  it('rejects relative paths, ~user and control characters', () => {
    expect(normalizeStartupDirectory('var/log').ok).toBe(false)
    expect(normalizeStartupDirectory('./app').ok).toBe(false)
    expect(normalizeStartupDirectory('~other').ok).toBe(false)
    expect(normalizeStartupDirectory('~other/app').ok).toBe(false)
    expect(normalizeStartupDirectory('/tmp/a\nb').ok).toBe(false)
    expect(normalizeStartupDirectory('/tmp/a\u001bb').ok).toBe(false)
    expect(normalizeStartupDirectory('/tmp/a\u007fb').ok).toBe(false)
    expect(normalizeStartupDirectory(`/${'a'.repeat(4096)}`).ok).toBe(false)
  })
})

describe('quotePosixArg', () => {
  it('quotes spaces, quotes and metacharacters as one argument', () => {
    expect(quotePosixArg('/var/my app')).toBe("'/var/my app'")
    expect(quotePosixArg("/tmp/it's")).toBe(String.raw`'/tmp/it'\''s'`)
    expect(quotePosixArg('/tmp/foo; rm -rf /')).toBe("'/tmp/foo; rm -rf /'")
    expect(startupCdCommand('/tmp/foo; rm -rf /')).toBe("cd -- '/tmp/foo; rm -rf /'\r")
    expect(startupCdCommandFromHome('foo; rm')).toBe(`cd -- "$HOME"'/foo; rm'\r`)
  })
})

describe('resolveStartupDirectory', () => {
  it('resolves ~ against the login directory', () => {
    expect(resolveStartupDirectory('~', '/home/u')).toBe('/home/u')
    expect(resolveStartupDirectory('~/app', '/home/u')).toBe('/home/u/app')
    expect(resolveStartupDirectory('~/app', '/home/u/')).toBe('/home/u/app')
    expect(resolveStartupDirectory('~/app', '/')).toBe('/app')
    expect(resolveStartupDirectory('/var/www', '/home/u')).toBe('/var/www')
    expect(canonicalPosixDir('/home/u/')).toBe('/home/u')
  })
})

describe('planStartupDirectory', () => {
  it('skips when the field is empty or the target is the login directory', () => {
    expect(planStartupDirectory({ raw: null, probe: { status: 'unavailable' } })).toEqual({
      kind: 'none'
    })
    expect(
      planStartupDirectory({
        raw: '~',
        probe: { status: 'ready', loginDirectory: '/home/u', targetIsDirectory: true }
      })
    ).toEqual({ kind: 'none' })
    expect(
      planStartupDirectory({
        raw: '/home/u/',
        probe: { status: 'ready', loginDirectory: '/home/u', targetIsDirectory: true }
      })
    ).toEqual({ kind: 'none' })
  })

  it('cds into a directory that stat confirmed', () => {
    expect(
      planStartupDirectory({
        raw: '~/app',
        probe: { status: 'ready', loginDirectory: '/home/u', targetIsDirectory: true }
      })
    ).toEqual({ kind: 'cd', command: "cd -- '/home/u/app'\r" })
  })

  it('notices and does not cd when the directory is missing', () => {
    const plan = planStartupDirectory({
      raw: '/missing; rm',
      probe: { status: 'ready', loginDirectory: '/home/u', targetIsDirectory: false }
    })
    expect(plan.kind).toBe('notice')
    if (plan.kind === 'notice') {
      expect(plan.message).toContain('/missing; rm')
      expect(plan.message).not.toContain('cd ')
    }
  })

  it('writes a quoted cd without a notice when SFTP never opened', () => {
    expect(planStartupDirectory({ raw: '/var/www', probe: { status: 'unavailable' } })).toEqual({
      kind: 'cd',
      command: "cd -- '/var/www'\r"
    })
    expect(planStartupDirectory({ raw: '~/app', probe: { status: 'unavailable' } })).toEqual({
      kind: 'cd',
      command: `cd -- "$HOME"'/app'\r`
    })
    expect(planStartupDirectory({ raw: '~', probe: { status: 'unavailable' } })).toEqual({
      kind: 'none'
    })
  })
})

describe('CreateConnectionInputSchema startupDirectory', () => {
  it('normalizes a valid path and rejects a relative one', () => {
    expect(
      CreateConnectionInputSchema.parse({ ...createBase, startupDirectory: ' ~/app/ ' })
        .startupDirectory
    ).toBe('~/app')
    expect(CreateConnectionInputSchema.parse(createBase).startupDirectory).toBeUndefined()
    expect(() =>
      CreateConnectionInputSchema.parse({ ...createBase, startupDirectory: 'var/log' })
    ).toThrow()
  })

  it('defaults a missing startupDirectory so an older inventory still parses', () => {
    const parsed = ConnectionSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      groupId: '22222222-2222-4222-8222-222222222222',
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
    expect(parsed.startupDirectory).toBeNull()
  })
})
