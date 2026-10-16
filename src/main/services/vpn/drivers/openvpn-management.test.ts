import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type ManagementEvent,
  ManagementLineBuffer,
  parseManagementLine,
  parsePushReply,
  quoteManagementArg
} from './openvpn-management'

const transcript = (name: string) =>
  readFileSync(resolve(__dirname, '../../../../../test/fixtures/openvpn-transcripts', name), 'utf8')
    .split('\n')
    .filter(Boolean)

describe('parseManagementLine', () => {
  it('parses the full happy-path transcript', () => {
    const events = transcript('connect-userpass-ok.txt').map(parseManagementLine)
    const types = events.map((e) => e.type)
    expect(types).toContain('password-prompt')
    expect(types).toContain('hold')
    expect(events).toContainEqual({
      type: 'need-password',
      realm: 'Private Key',
      needsUsername: false
    })
    expect(events).toContainEqual({ type: 'need-password', realm: 'Auth', needsUsername: true })
    expect(events.at(-1)).toEqual({
      type: 'state',
      state: 'CONNECTED',
      detail: 'SUCCESS',
      localIp: '10.8.0.6',
      remoteIp: '203.0.113.10'
    })
  })

  it('verification failures carry the realm', () => {
    const events = transcript('connect-auth-failed.txt').map(parseManagementLine)
    expect(events).toContainEqual({ type: 'verification-failed', realm: 'Auth' })
    expect(events.at(-1)?.type).toBe('fatal')
    expect(transcript('key-passphrase-wrong.txt').map(parseManagementLine)).toContainEqual({
      type: 'verification-failed',
      realm: 'Private Key'
    })
  })

  it('reconnecting / exiting states', () => {
    const states = transcript('drop-reconnecting.txt')
      .map(parseManagementLine)
      .filter((e): e is Extract<ManagementEvent, { type: 'state' }> => e.type === 'state')
      .map((e) => [e.state, e.detail])
    expect(states).toEqual([
      ['CONNECTED', 'SUCCESS'],
      ['RECONNECTING', 'ping-restart'],
      ['EXITING', 'SIGTERM']
    ])
  })

  it('log lines and command responses', () => {
    expect(parseManagementLine('>LOG:1760630001,W,something happened')).toEqual({
      type: 'log',
      message: 'something happened'
    })
    expect(parseManagementLine('SUCCESS: hold release succeeded')).toEqual({
      type: 'success',
      message: 'hold release succeeded'
    })
    expect(parseManagementLine('ERROR: unknown command')).toEqual({
      type: 'error',
      message: 'unknown command'
    })
    expect(parseManagementLine('random')).toEqual({ type: 'other', line: 'random' })
  })
})

describe('parsePushReply', () => {
  it('extracts routes (as CIDR), ifconfig and redirect-gateway', () => {
    const log = transcript('connect-userpass-ok.txt').find((l) =>
      l.includes('PUSH_REPLY')
    ) as string
    const event = parseManagementLine(log)
    expect(event.type).toBe('log')
    expect(parsePushReply((event as { message: string }).message)).toEqual({
      routes: ['10.20.0.0/16', '192.168.50.0/24'],
      localIp: '10.8.0.6',
      redirectGateway: false
    })
    expect(
      parsePushReply("PUSH: Received control message: 'PUSH_REPLY,redirect-gateway def1'")
    ).toEqual({
      routes: [],
      redirectGateway: true
    })
    expect(parsePushReply('unrelated')).toBeNull()
  })
})

describe('quoteManagementArg', () => {
  it('escapes backslashes and quotes', () => {
    expect(quoteManagementArg('pa"ss\\word')).toBe('"pa\\"ss\\\\word"')
  })

  it('rejects newlines (would inject a second command)', () => {
    expect(() => quoteManagementArg('a\nsignal SIGTERM')).toThrow()
  })
})

describe('ManagementLineBuffer', () => {
  it('splits chunks across boundaries, handles CRLF, and the unterminated password prompt', () => {
    const buf = new ManagementLineBuffer()
    expect(buf.push('ENTER PASSWORD:')).toEqual(['ENTER PASSWORD:'])
    expect(buf.push('>HOLD:Wait')).toEqual([])
    expect(buf.push('ing\r\n>STATE:1,WAIT,,,,,,\r\n')).toEqual([
      '>HOLD:Waiting',
      '>STATE:1,WAIT,,,,,,'
    ])
  })
})
