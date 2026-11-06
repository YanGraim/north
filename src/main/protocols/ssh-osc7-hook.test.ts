import { EventEmitter } from 'node:events'
import type { Client, ClientChannel } from 'ssh2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BASH_OSC7_HOOK,
  createEchoSuppressor,
  loginShell,
  readLoginShell,
  runSavedShellStartup,
  SHELL_PROBE_COMMAND,
  ZSH_OSC7_HOOK
} from './ssh-osc7-hook'

function asText(data: Uint8Array): string {
  return Buffer.from(data).toString('utf8')
}

function assertHookIsQuiet(line: string): void {
  expect(line).not.toContain('\n')
  expect(line).not.toContain('.bashrc')
  expect(line).not.toContain('.zshrc')
  expect(line).not.toContain('.profile')
  expect(line).not.toMatch(/(^|[;&|`])\s*ls(\s|$)/)
  expect(line).toContain("printf $'\\033]7;file://localhost%s\\a'")
}

describe('loginShell', () => {
  it('accepts bash and zsh paths only', () => {
    expect(loginShell('/bin/bash')).toBe('bash')
    expect(loginShell('/usr/local/bin/zsh')).toBe('zsh')
    expect(loginShell('bash')).toBe('bash')
    expect(loginShell('  /bin/zsh  ')).toBe('zsh')
  })

  it('rejects fish, dash, ash, and a plain sh', () => {
    expect(loginShell('/usr/bin/fish')).toBeNull()
    expect(loginShell('/bin/dash')).toBeNull()
    expect(loginShell('/bin/ash')).toBeNull()
    expect(loginShell('/bin/sh')).toBeNull()
    expect(loginShell('')).toBeNull()
  })
})

describe('OSC 7 hook text', () => {
  it('appends to bash PROMPT_COMMAND and does not list the directory', () => {
    assertHookIsQuiet(BASH_OSC7_HOOK)
    expect(BASH_OSC7_HOOK).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: bash source, not a JS template
      'PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND; }__north_osc7"'
    )
    expect(BASH_OSC7_HOOK).toContain('PROMPT_COMMAND+=(__north_osc7)')
    expect(BASH_OSC7_HOOK).not.toMatch(/PROMPT_COMMAND=\(/)
    expect(BASH_OSC7_HOOK).not.toContain('PROMPT_COMMAND=__north_osc7')
  })

  it('appends to zsh precmd_functions and does not replace precmd', () => {
    assertHookIsQuiet(ZSH_OSC7_HOOK)
    expect(ZSH_OSC7_HOOK).toContain('precmd_functions+=(__north_osc7)')
    expect(ZSH_OSC7_HOOK).not.toMatch(/precmd_functions=\(/)
    expect(ZSH_OSC7_HOOK).not.toContain('precmd()')
    expect(ZSH_OSC7_HOOK).not.toContain('PROMPT_COMMAND')
  })
})

describe('createEchoSuppressor', () => {
  it('drops one exact hook echo and keeps the break and the next prompt', () => {
    const suppress = createEchoSuppressor(BASH_OSC7_HOOK)
    const echoed = `${BASH_OSC7_HOOK}\r\n[root@host portal]# `
    expect(asText(suppress.push(Buffer.from(echoed)))).toBe('\r\n[root@host portal]# ')
  })

  it('holds a split echo and forwards only what follows the match', () => {
    const suppress = createEchoSuppressor(ZSH_OSC7_HOOK)
    const cut = 17
    expect(suppress.push(Buffer.from(ZSH_OSC7_HOOK.slice(0, cut))).length).toBe(0)
    const rest = `${ZSH_OSC7_HOOK.slice(cut)}\r\n% `
    expect(asText(suppress.push(Buffer.from(rest)))).toBe('\r\n% ')
  })

  it('replays a partial match when the echo diverges, and drops only one echo', () => {
    const suppress = createEchoSuppressor('echo hi')
    expect(asText(suppress.push(Buffer.from('echo ')))).toBe('')
    expect(asText(suppress.push(Buffer.from('no\r\n')))).toBe('echo no\r\n')
    expect(asText(suppress.push(Buffer.from('echo hi\r\n')))).toBe('\r\n')
    expect(asText(suppress.push(Buffer.from('echo hi\r\n')))).toBe('echo hi\r\n')
  })

  it('finds the echo after the login banner and the first prompt', () => {
    const suppress = createEchoSuppressor(BASH_OSC7_HOOK)
    const banner = 'Last login: Fri Nov  6 16:41:11 2026 from 177.72.44.56\r\nroot@logsync:~# '
    const out = [
      suppress.push(Buffer.from(banner.slice(0, 30))),
      suppress.push(Buffer.from(banner.slice(30) + BASH_OSC7_HOOK.slice(0, 40))),
      suppress.push(Buffer.from(`${BASH_OSC7_HOOK.slice(40)}\r\nroot@logsync:~# `))
    ]
      .map(asText)
      .join('')
    expect(out).toBe(`${banner}\r\nroot@logsync:~# `)
  })

  it('a repeated first character does not lose the start of the echo', () => {
    const suppress = createEchoSuppressor('__north')
    expect(asText(suppress.push(Buffer.from('a___north!')))).toBe('a_!')
  })

  it('gives up after a lot of output without the echo', () => {
    const suppress = createEchoSuppressor(BASH_OSC7_HOOK)
    const big = 'x'.repeat(70 * 1024)
    expect(asText(suppress.push(Buffer.from(big))).length).toBe(big.length)
    expect(asText(suppress.push(Buffer.from(BASH_OSC7_HOOK)))).toBe(BASH_OSC7_HOOK)
  })

  it('forwards output that does not start with the hook', () => {
    const suppress = createEchoSuppressor(BASH_OSC7_HOOK)
    const motd = 'Last login: Wed Nov 4\r\n'
    expect(asText(suppress.push(Buffer.from(motd)))).toBe(motd)
  })

  it('does not filter when the line is empty', () => {
    const suppress = createEchoSuppressor('')
    expect(asText(suppress.push(Buffer.from('prompt')))).toBe('prompt')
  })
})

describe('runSavedShellStartup', () => {
  it('probes and writes only after the startup step, and only for bash or zsh', async () => {
    const steps: string[] = []
    const notice = await runSavedShellStartup({
      connectionId: 'connection-1',
      isCancelled: () => false,
      applyStartup: async () => {
        steps.push('startup')
        return 'notice'
      },
      readShell: async () => {
        steps.push('probe')
        return '/bin/bash'
      },
      write: (line) => {
        steps.push(`write:${line === BASH_OSC7_HOOK ? 'bash' : 'other'}`)
      }
    })
    expect(notice).toBe('notice')
    expect(steps).toEqual(['startup', 'probe', 'write:bash'])
  })

  it('writes the zsh line once', async () => {
    const written: string[] = []
    await runSavedShellStartup({
      connectionId: 'connection-1',
      isCancelled: () => false,
      applyStartup: async () => null,
      readShell: async () => '/usr/bin/zsh\n',
      write: (line) => written.push(line)
    })
    expect(written).toEqual([ZSH_OSC7_HOOK])
  })

  it('does not write for fish, dash, a failed probe, or a missing connection', async () => {
    const written: string[] = []
    const probes: string[] = []
    await runSavedShellStartup({
      connectionId: 'connection-1',
      isCancelled: () => false,
      applyStartup: async () => null,
      readShell: async () => {
        probes.push('fish')
        return '/usr/bin/fish'
      },
      write: (line) => written.push(line)
    })
    await runSavedShellStartup({
      connectionId: 'connection-1',
      isCancelled: () => false,
      applyStartup: async () => null,
      readShell: async () => '/bin/dash',
      write: (line) => written.push(line)
    })
    await runSavedShellStartup({
      connectionId: 'connection-1',
      isCancelled: () => false,
      applyStartup: async () => null,
      readShell: async () => {
        throw new Error('exec failed')
      },
      write: (line) => written.push(line)
    })
    await runSavedShellStartup({
      connectionId: null,
      isCancelled: () => false,
      applyStartup: async () => null,
      readShell: async () => {
        probes.push('skipped')
        return '/bin/bash'
      },
      write: (line) => written.push(line)
    })
    expect(written).toEqual([])
    expect(probes).toEqual(['fish'])
  })

  it('still connects when startup throws, and skips the hook when cancelled', async () => {
    const steps: string[] = []
    await runSavedShellStartup({
      connectionId: 'connection-1',
      isCancelled: () => false,
      applyStartup: async () => {
        throw new Error('sftp down')
      },
      readShell: async () => '/bin/bash',
      write: () => steps.push('write')
    })
    expect(steps).toEqual(['write'])

    let cancel = false
    await runSavedShellStartup({
      connectionId: 'connection-1',
      isCancelled: () => cancel,
      applyStartup: async () => {
        cancel = true
        return null
      },
      readShell: async () => {
        steps.push('probe')
        return '/bin/bash'
      },
      write: () => steps.push('write-late')
    })
    expect(steps).toEqual(['write'])
  })
})

describe('readLoginShell', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the fixed probe and returns stdout', async () => {
    const seen: string[] = []
    const client = {
      exec(command: string, callback: (err: Error | undefined, stream: ClientChannel) => void) {
        seen.push(command)
        const stream = new EventEmitter() as ClientChannel
        stream.stderr = new EventEmitter() as ClientChannel['stderr']
        stream.close = () => undefined
        callback(undefined, stream)
        queueMicrotask(() => {
          stream.emit('data', Buffer.from('/bin/bash'))
          stream.emit('close')
        })
      }
    } as unknown as Client
    await expect(readLoginShell(client, () => false)).resolves.toBe('/bin/bash')
    expect(seen).toEqual([SHELL_PROBE_COMMAND])
  })

  it('returns null when exec fails or the probe hangs', async () => {
    const failed = {
      exec(_command: string, callback: (err: Error | undefined, stream: ClientChannel) => void) {
        callback(new Error('nope'), undefined as unknown as ClientChannel)
      }
    } as unknown as Client
    await expect(readLoginShell(failed, () => false)).resolves.toBeNull()

    vi.useFakeTimers()
    const hanging = {
      exec(_command: string, callback: (err: Error | undefined, stream: ClientChannel) => void) {
        const stream = new EventEmitter() as ClientChannel
        stream.stderr = new EventEmitter() as ClientChannel['stderr']
        stream.close = () => stream.emit('close')
        callback(undefined, stream)
      }
    } as unknown as Client
    const pending = readLoginShell(hanging, () => false)
    await vi.advanceTimersByTimeAsync(SHELL_PROBE_WAIT_MS)
    await expect(pending).resolves.toBeNull()
  })
})

const SHELL_PROBE_WAIT_MS = 4000
