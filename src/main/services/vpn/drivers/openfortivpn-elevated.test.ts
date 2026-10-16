import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildElevatedCommand, type PrivilegeBroker } from '../privilege-broker'
import { OpenfortivpnDriver } from './openfortivpn-driver'

const FAKE = resolve(__dirname, '../../../../../test/fixtures/fake-openfortivpn.mjs')

/**
 * Runs the exact command string sudo-prompt would elevate through /bin/sh (without
 * elevation) — catches quoting/line-break bugs that a direct spawn can't see.
 */
describe.runIf(process.platform !== 'win32')('openfortivpn via the elevated command string', () => {
  it('starts, reports up, keeps the password out of the command, and stops via the stop file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'north-forti-elev-'))
    let command = ''
    const broker: PrivilegeBroker = {
      launch(binary, args) {
        command = buildElevatedCommand(binary, args)
        const child = spawn('/bin/sh', ['-c', command], { stdio: 'ignore' })
        return { exited: new Promise((done) => child.once('exit', (code) => done({ code }))) }
      },
      kill: async () => {}
    }
    try {
      const driver = new OpenfortivpnDriver({
        binary: () => FAKE,
        broker,
        tmpDir: join(dir, 'tmp'),
        pollMs: 20
      })
      const info = await driver.connect({
        profile: {
          id: '33333333-3333-4333-8333-333333333333',
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
          createdAt: '2026-10-16T00:00:00.000Z',
          updatedAt: '2026-10-16T00:00:00.000Z'
        },
        secrets: { get: () => 'pw-ok', inlineBlocks: () => ({}) },
        log: () => {},
        signal: new AbortController().signal
      })
      expect(info.localIp).toBe('10.212.134.200')
      expect(command).not.toMatch(/[\r\n]/)
      expect(command).not.toContain('pw-ok')
      await driver.disconnect()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 15_000)
})
