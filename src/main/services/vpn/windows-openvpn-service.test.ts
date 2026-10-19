import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildStartupMessage,
  OpenvpnServiceBroker,
  parseServiceReply,
  winQuoteArg
} from './windows-openvpn-service'

describe('winQuoteArg (CommandLineToArgvW rules)', () => {
  it('leaves plain args alone and quotes spaces', () => {
    expect(winQuoteArg('--config')).toBe('--config')
    expect(winQuoteArg('C:\\Users\\Ana Maria\\x.ovpn')).toBe('"C:\\Users\\Ana Maria\\x.ovpn"')
    expect(winQuoteArg('')).toBe('""')
  })
  it('doubles backslashes only before a quote or the closing quote', () => {
    expect(winQuoteArg('C:\\dir with space\\')).toBe('"C:\\dir with space\\\\"')
    expect(winQuoteArg('a"b')).toBe('"a\\"b"')
  })
})

describe('startup message', () => {
  it('is UTF-16LE workdir NUL options NUL stdin NUL', () => {
    const msg = buildStartupMessage('C:\\w', ['--config', 'C:\\a b.ovpn'])
    expect(msg.toString('utf16le')).toBe('C:\\w\0--config "C:\\a b.ovpn"\0\0')
  })
  it('refuses NUL smuggling', () => {
    expect(() => buildStartupMessage('C:\\w', ['--config\0x'])).toThrow()
  })
})

describe('service reply', () => {
  it('pid and error forms', () => {
    expect(parseServiceReply('0x00000000\n0x00001a2b\nProcess ID')).toEqual({ pid: 0x1a2b })
    expect(parseServiceReply('0x20000000\nValidateOptions\nOption not allowed')).toEqual({
      error: 'Option not allowed (0x20000000)'
    })
    expect(parseServiceReply('0x0000')).toBeNull()
  })
})

// The broker against a fake service on a unix socket (same stream semantics as a named pipe).
describe.runIf(process.platform !== 'win32')('OpenvpnServiceBroker', () => {
  let dir: string
  let server: Server
  afterEach(() => {
    server?.close()
    rmSync(dir, { recursive: true, force: true })
  })

  const fakeService = (reply: string, holdMs: number) =>
    new Promise<{ path: string; received: Promise<string> }>((resolve) => {
      dir = mkdtempSync(join(tmpdir(), 'ovpn-svc-'))
      const path = join(dir, 'service')
      let gotData: (s: string) => void = () => {}
      const received = new Promise<string>((r) => {
        gotData = r
      })
      server = createServer((socket) => {
        socket.once('data', (chunk) => {
          gotData(chunk.toString('utf16le'))
          socket.write(Buffer.from(reply, 'utf16le'))
          setTimeout(() => socket.end(), holdMs)
        })
      })
      server.listen(path, () => resolve({ path, received }))
    })

  it('starts openvpn through the service and resolves when the pipe closes (process exit)', async () => {
    const { path, received } = await fakeService('0x00000000\n0x00000064\nProcess ID', 50)
    const broker = new OpenvpnServiceBroker('C:\\tmp', path)
    const result = await broker.launch('ignored', ['--config', 'C:\\tmp\\p.ovpn']).exited
    expect(await received).toBe('C:\\tmp\0--config C:\\tmp\\p.ovpn\0\0')
    expect(result).toEqual({ code: 0 })
  })

  it('surfaces a service refusal', async () => {
    const { path } = await fakeService('0x20000000\nValidateOptions\nOption not allowed', 1000)
    const result = await new OpenvpnServiceBroker('C:\\tmp', path).launch('x', []).exited
    expect(result.error?.message).toMatch(/Option not allowed/)
  })

  it('missing service → BINARY_MISSING with the install hint', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ovpn-svc-'))
    const result = await new OpenvpnServiceBroker('C:\\tmp', join(dir, 'none')).launch('x', [])
      .exited
    expect(result.error?.code).toBe('BINARY_MISSING')
  })
})
