import { startupCdCommand } from '@shared/lib/startup-directory'
import { describe, expect, it } from 'vitest'
import { resolveShellCdPath, ShellPromptGate } from './shell-prompt-gate'

function osc(path: string): Uint8Array {
  return new TextEncoder().encode(`\x1b]7;file://localhost${path}\x07`)
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

describe('resolveShellCdPath', () => {
  it('accepts a safe absolute and resolves ~ against the login directory', () => {
    expect(resolveShellCdPath('/var/log', '/home/u')).toBe('/var/log')
    expect(resolveShellCdPath('~/app', '/home/u')).toBe('/home/u/app')
    expect(resolveShellCdPath('~', '/home/u')).toBe('/home/u')
  })

  it('refuses a relative path, ~other, and a path with a control character', () => {
    expect(resolveShellCdPath('var', '/home/u')).toBeNull()
    expect(resolveShellCdPath('~other', '/home/u')).toBeNull()
    expect(resolveShellCdPath('/tmp/a\nb', '/home/u')).toBeNull()
    expect(resolveShellCdPath('~/app', null)).toBeNull()
  })
})

describe('ShellPromptGate', () => {
  it('writes startupCdCommand when the line is empty', () => {
    const gate = new ShellPromptGate()
    expect(gate.noteStdout(osc('/var'))).toBeNull()
    expect(gate.request('/var/log')).toEqual({
      ok: true,
      pending: false,
      command: startupCdCommand('/var/log')
    })
  })

  it('quotes a path that contains shell metacharacters', () => {
    const gate = new ShellPromptGate()
    gate.noteStdout(osc('/var'))
    expect(gate.request('/tmp/foo; rm -rf /etc')).toEqual({
      ok: true,
      pending: false,
      command: startupCdCommand('/tmp/foo; rm -rf /etc')
    })
  })

  it('waits while the line is dirty and writes after the next prompt', () => {
    const gate = new ShellPromptGate()
    gate.noteStdout(osc('/var'))
    gate.noteStdin(text('ls'))
    expect(gate.request('/var/log')).toEqual({ ok: true, pending: true, command: null })
    expect(gate.noteStdin(text('\r'))).toBeNull()
    expect(gate.noteStdout(osc('/var'))).toBe(startupCdCommand('/var/log'))
  })

  it('does not write the same path the OSC 7 already lists', () => {
    const gate = new ShellPromptGate()
    gate.noteStdout(osc('/var'))
    expect(gate.request('/var')).toEqual({ ok: true, pending: false, command: null })
    expect(gate.request('/var/')).toEqual({ ok: true, pending: false, command: null })
  })

  it('replaces a queued path with the latest request', () => {
    const gate = new ShellPromptGate()
    gate.noteStdout(osc('/var'))
    gate.noteStdin(text('x'))
    gate.request('/tmp/a')
    expect(gate.request('/tmp/b')).toEqual({ ok: true, pending: true, command: null })
    gate.noteStdin(text('\r'))
    expect(gate.noteStdout(osc('/var'))).toBe(startupCdCommand('/tmp/b'))
  })

  it('drops the queue when cancelled, even after the next prompt', () => {
    const gate = new ShellPromptGate()
    gate.noteStdout(osc('/var'))
    gate.noteStdin(text('x'))
    gate.request('/tmp/b')
    gate.cancel()
    gate.noteStdin(text('\r'))
    expect(gate.noteStdout(osc('/var'))).toBeNull()
  })

  it('refuses an unsafe path and does not write it later', () => {
    const gate = new ShellPromptGate()
    gate.noteStdout(osc('/var'))
    expect(gate.request('var')).toEqual({ ok: false, reason: 'invalid' })
    expect(gate.request('/tmp/a\nb')).toEqual({ ok: false, reason: 'invalid' })
    expect(gate.noteStdout(osc('/tmp'))).toBeNull()
  })

  it('joins an OSC 7 that arrives in two chunks', () => {
    const gate = new ShellPromptGate()
    const bytes = osc('/var/log')
    const mid = Math.floor(bytes.length / 2)
    expect(gate.noteStdout(bytes.slice(0, mid))).toBeNull()
    expect(gate.noteStdout(bytes.slice(mid))).toBeNull()
    expect(gate.currentDirectory()).toBe('/var/log')
  })
})
