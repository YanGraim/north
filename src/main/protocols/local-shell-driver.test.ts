import os from 'node:os'
import { describe, expect, it } from 'vitest'
import { LocalShellDriver } from './local-shell-driver'

describe('LocalShellDriver', () => {
  it('spawns a pty, relays data through the port, and disposes cleanly', async () => {
    const driver = new LocalShellDriver()
    const session = await driver.createSession('session-1')

    expect(session.kind).toBe('terminal')
    expect(session.protocol).toBe('local-shell')
    expect(session.state).toBe('connected')

    const received: unknown[] = []
    session.attachPort({
      postMessage: (message) => received.push(message),
      close: () => undefined,
      on: () => undefined,
      start: () => undefined
    })

    session.terminal?.write(new TextEncoder().encode('echo hi\n'))

    await new Promise<void>((resolve) => {
      const start = Date.now()
      const poll = (): void => {
        if (
          received.some((m) => (m as { type?: string }).type === 'data') ||
          Date.now() - start > 5000
        ) {
          resolve()
          return
        }
        setTimeout(poll, 50)
      }
      poll()
    })

    expect(received.some((m) => (m as { type?: string }).type === 'data')).toBe(true)

    await session.dispose()
    expect(session.state).toBe('closed')
  })

  it('resize does not throw before or after dispose', async () => {
    const driver = new LocalShellDriver()
    const session = await driver.createSession('session-2')
    session.attachPort({
      postMessage: () => undefined,
      close: () => undefined,
      on: () => undefined,
      start: () => undefined
    })

    expect(() => session.terminal?.resize(100, 30)).not.toThrow()
    await session.dispose()
    expect(() => session.terminal?.resize(80, 24)).not.toThrow()
  })

  it('runs opts.command through the shell in opts.cwd (agent workspace use case)', async () => {
    const driver = new LocalShellDriver()
    const cwd = os.tmpdir()
    const session = await driver.createSession('session-3', {
      cwd,
      command: 'echo agent-workspace-ok && pwd'
    })

    const received: unknown[] = []
    session.attachPort({
      postMessage: (message) => received.push(message),
      close: () => undefined,
      on: () => undefined,
      start: () => undefined
    })

    await new Promise<void>((resolve) => {
      const start = Date.now()
      const poll = (): void => {
        const text = received
          .filter((m) => (m as { type?: string }).type === 'data')
          .map((m) => Buffer.from((m as { data: Uint8Array }).data).toString('utf-8'))
          .join('')
        if (text.includes('agent-workspace-ok') || Date.now() - start > 5000) {
          resolve()
          return
        }
        setTimeout(poll, 50)
      }
      poll()
    })

    const output = received
      .filter((m) => (m as { type?: string }).type === 'data')
      .map((m) => Buffer.from((m as { data: Uint8Array }).data).toString('utf-8'))
      .join('')
    expect(output).toContain('agent-workspace-ok')

    await session.dispose()
  })
})
