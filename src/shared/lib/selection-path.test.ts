import { describe, expect, it } from 'vitest'
import type { LogFileDraft } from './log-file'
import {
  ClassifyPathArgsSchema,
  ClassifyPathResultSchema,
  planLogFileFromSelection,
  planStartupDirectoryFromPane,
  planStartupDirectoryFromSelection,
  posixParent
} from './selection-path'

const FILE_ID = '11111111-1111-4111-8111-111111111111'
const LOG = '/var/www/html/portal/storage/logs/laravel-2026-10-31.log'

function draft(index: number, path: string): LogFileDraft {
  const tail = index.toString(16).padStart(12, '0')
  return { id: `00000000-0000-4000-8000-${tail}`, path, label: null }
}

describe('posixParent', () => {
  it('stops at / and at ~', () => {
    expect(posixParent('/file')).toBe('/')
    expect(posixParent('/')).toBe('/')
    expect(posixParent('~/file')).toBe('~')
    expect(posixParent('~')).toBe('~')
    expect(posixParent('~/app/file.log')).toBe('~/app')
    expect(posixParent('/var/www/app')).toBe('/var/www')
  })
})

describe('planStartupDirectoryFromSelection', () => {
  it('stores a directory as itself', () => {
    const plan = planStartupDirectoryFromSelection({
      selection: '/var/www/app',
      kind: 'directory',
      absolute: '/var/www/app',
      current: null
    })
    expect(plan).toEqual({
      ok: true,
      stored: '/var/www/app',
      absoluteDir: '/var/www/app',
      command: "cd -- '/var/www/app'\r",
      unchanged: false
    })
  })

  it('stores the parent when the selection is a file', () => {
    const plan = planStartupDirectoryFromSelection({
      selection: LOG,
      kind: 'file',
      absolute: LOG,
      current: null
    })
    expect(plan).toMatchObject({
      ok: true,
      stored: '/var/www/html/portal/storage/logs',
      absoluteDir: '/var/www/html/portal/storage/logs',
      command: "cd -- '/var/www/html/portal/storage/logs'\r"
    })
  })

  it('keeps the ~/ form and cds the absolute parent', () => {
    const plan = planStartupDirectoryFromSelection({
      selection: '~/app/file.log',
      kind: 'file',
      absolute: '/home/u/app/file.log',
      current: null
    })
    expect(plan).toEqual({
      ok: true,
      stored: '~/app',
      absoluteDir: '/home/u/app',
      command: "cd -- '/home/u/app'\r",
      unchanged: false
    })
  })

  it('does not climb above / or ~', () => {
    expect(
      planStartupDirectoryFromSelection({
        selection: '/app.log',
        kind: 'file',
        absolute: '/app.log',
        current: null
      })
    ).toMatchObject({ ok: true, stored: '/', absoluteDir: '/', command: "cd -- '/'\r" })
    expect(
      planStartupDirectoryFromSelection({
        selection: '~/app.log',
        kind: 'file',
        absolute: '/home/u/app.log',
        current: null
      })
    ).toMatchObject({
      ok: true,
      stored: '~',
      absoluteDir: '/home/u',
      command: "cd -- '/home/u'\r"
    })
  })

  it('quotes spaces, quotes and metacharacters in the cd command', () => {
    const spaced = planStartupDirectoryFromSelection({
      selection: '/var/my app/notes.txt',
      kind: 'file',
      absolute: '/var/my app/notes.txt',
      current: null
    })
    expect(spaced).toMatchObject({
      ok: true,
      stored: '/var/my app',
      command: "cd -- '/var/my app'\r"
    })
    const quoted = planStartupDirectoryFromSelection({
      selection: "/tmp/it's a dir",
      kind: 'directory',
      absolute: "/tmp/it's a dir",
      current: null
    })
    expect(quoted).toMatchObject({
      ok: true,
      command: `cd -- ${String.raw`'/tmp/it'\''s a dir'`}\r`
    })
    const injected = planStartupDirectoryFromSelection({
      selection: '/tmp/foo; rm -rf /etc',
      kind: 'directory',
      absolute: '/tmp/foo; rm -rf /etc',
      current: null
    })
    expect(injected).toMatchObject({
      ok: true,
      command: "cd -- '/tmp/foo; rm -rf /etc'\r"
    })
  })

  it('flags an unchanged directory and a different one', () => {
    expect(
      planStartupDirectoryFromSelection({
        selection: '~/app/',
        kind: 'directory',
        absolute: '/home/u/app',
        current: '~/app'
      })
    ).toMatchObject({ ok: true, stored: '~/app', unchanged: true })
    expect(
      planStartupDirectoryFromSelection({
        selection: '/var/www',
        kind: 'directory',
        absolute: '/var/www',
        current: '/var'
      })
    ).toMatchObject({ ok: true, unchanged: false })
  })

  it('rejects a path that is not a file or directory, and unsafe absolutes', () => {
    expect(
      planStartupDirectoryFromSelection({
        selection: 'var/log',
        kind: 'directory',
        absolute: '/var/log',
        current: null
      })
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(
      planStartupDirectoryFromSelection({
        selection: '/var/run/docker.sock',
        kind: 'other',
        absolute: '/var/run/docker.sock',
        current: null
      })
    ).toEqual({ ok: false, reason: 'other' })
    expect(
      planStartupDirectoryFromSelection({
        selection: '/missing',
        kind: 'missing',
        absolute: null,
        current: null
      })
    ).toEqual({ ok: false, reason: 'missing' })
    expect(
      planStartupDirectoryFromSelection({
        selection: '/var/log',
        kind: 'directory',
        absolute: '/var/log\n',
        current: null
      })
    ).toEqual({ ok: false, reason: 'unavailable' })
  })
})

describe('planStartupDirectoryFromPane', () => {
  it('rejects a relative path, ~other, a control character and a blank path', () => {
    for (const path of ['var/log', '~outro', '/tmp/a\nb', '']) {
      expect(planStartupDirectoryFromPane({ path, current: null })).toEqual({
        ok: false,
        reason: 'invalid'
      })
    }
  })

  it('saves without confirm when the current directory is empty', () => {
    expect(
      planStartupDirectoryFromPane({
        path: '/var/www/html/gruppe/storage/logs',
        current: null
      })
    ).toEqual({
      ok: true,
      stored: '/var/www/html/gruppe/storage/logs',
      unchanged: false,
      needsConfirm: false
    })
    expect(planStartupDirectoryFromPane({ path: '/var/log', current: '   ' })).toEqual({
      ok: true,
      stored: '/var/log',
      unchanged: false,
      needsConfirm: false
    })
  })

  it('treats a trailing slash as the same directory', () => {
    expect(planStartupDirectoryFromPane({ path: '/var/log/', current: '/var/log' })).toEqual({
      ok: true,
      stored: '/var/log',
      unchanged: true,
      needsConfirm: false
    })
    expect(planStartupDirectoryFromPane({ path: '/var/log', current: '/var/log/' })).toEqual({
      ok: true,
      stored: '/var/log',
      unchanged: true,
      needsConfirm: false
    })
  })

  it('asks to confirm when the current directory is different', () => {
    expect(planStartupDirectoryFromPane({ path: '/var/www', current: '/var/log' })).toEqual({
      ok: true,
      stored: '/var/www',
      unchanged: false,
      needsConfirm: true
    })
  })

  it('treats ~ and an absolute home as different directories', () => {
    expect(planStartupDirectoryFromPane({ path: '/home/usuario', current: '~' })).toEqual({
      ok: true,
      stored: '/home/usuario',
      unchanged: false,
      needsConfirm: true
    })
    expect(planStartupDirectoryFromPane({ path: '~', current: '/home/usuario' })).toEqual({
      ok: true,
      stored: '~',
      unchanged: false,
      needsConfirm: true
    })
  })
})

describe('planLogFileFromSelection', () => {
  it('appends a regular file with a null label', () => {
    const plan = planLogFileFromSelection({
      selection: '~/app/app.log',
      kind: 'file',
      existing: [],
      id: FILE_ID
    })
    expect(plan).toEqual({
      ok: true,
      id: FILE_ID,
      path: '~/app/app.log',
      files: [{ id: FILE_ID, path: '~/app/app.log', label: null }]
    })
  })

  it('rejects a directory, a socket and a missing path', () => {
    expect(
      planLogFileFromSelection({
        selection: '/var/log',
        kind: 'directory',
        existing: [],
        id: FILE_ID
      })
    ).toEqual({ ok: false, reason: 'not-file' })
    expect(
      planLogFileFromSelection({
        selection: '/var/run/docker.sock',
        kind: 'other',
        existing: [],
        id: FILE_ID
      })
    ).toEqual({ ok: false, reason: 'not-file' })
    expect(
      planLogFileFromSelection({
        selection: '/var/log/app.log',
        kind: 'missing',
        existing: [],
        id: FILE_ID
      })
    ).toEqual({ ok: false, reason: 'missing' })
  })

  it('rejects a duplicate and a ninth file without building a list', () => {
    const existing = [draft(1, '/var/log/app.log')]
    expect(
      planLogFileFromSelection({
        selection: '/var/log/app.log',
        kind: 'file',
        existing,
        id: FILE_ID
      })
    ).toEqual({ ok: false, reason: 'duplicate' })

    const full = Array.from({ length: 8 }, (_, index) => draft(index + 1, `/var/log/${index}.log`))
    expect(
      planLogFileFromSelection({
        selection: '/var/log/ninth.log',
        kind: 'file',
        existing: full,
        id: FILE_ID
      })
    ).toEqual({ ok: false, reason: 'limit' })
  })

  it('rejects a relative path, ~other, quotes and a newline', () => {
    for (const selection of ['var/log', '~outro', "'/var/log'", '/tmp/a\nb']) {
      expect(
        planLogFileFromSelection({ selection, kind: 'file', existing: [], id: FILE_ID })
      ).toEqual({ ok: false, reason: 'invalid' })
    }
  })
})

describe('classify path schema', () => {
  it('accepts the invoke args and a stat result', () => {
    expect(
      ClassifyPathArgsSchema.safeParse({ sessionId: 'sess-1', path: '~/app/app.log' }).success
    ).toBe(true)
    expect(
      ClassifyPathResultSchema.safeParse({
        kind: 'file',
        path: '~/app/app.log',
        absolute: '/home/u/app/app.log'
      }).success
    ).toBe(true)
    expect(
      ClassifyPathResultSchema.safeParse({ kind: 'missing', path: '/nope', absolute: null }).success
    ).toBe(true)
  })
})
