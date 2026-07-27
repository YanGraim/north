import { describe, expect, it } from 'vitest'
import {
  fingerprintHostKey,
  formatSshClientError,
  parseHostKeyType,
  parseSshConnectionConfig
} from './ssh-utils'

describe('ssh-utils', () => {
  it('parses valid connection config', () => {
    expect(parseSshConnectionConfig({ host: ' 10.0.0.1 ', port: 22, username: 'ubuntu' })).toEqual({
      host: '10.0.0.1',
      port: 22,
      username: 'ubuntu'
    })
  })

  it('rejects empty host and invalid port', () => {
    expect(() => parseSshConnectionConfig({ host: '  ', port: 22, username: null })).toThrow(
      /host/i
    )
    expect(() => parseSshConnectionConfig({ host: 'a', port: 0, username: null })).toThrow(/port/i)
    expect(() => parseSshConnectionConfig({ host: 'a', port: 70000, username: null })).toThrow(
      /port/i
    )
  })

  it('fingerprints host keys as SHA256', () => {
    const key = Buffer.from('ssh-test-key-bytes')
    const fp = fingerprintHostKey(key)
    expect(fp.startsWith('SHA256:')).toBe(true)
    expect(fp).toBe(fingerprintHostKey(new Uint8Array(key)))
  })

  it('parses host key algorithm prefix', () => {
    const algo = 'ssh-ed25519'
    const header = Buffer.alloc(4 + algo.length)
    header.writeUInt32BE(algo.length, 0)
    header.write(algo, 4)
    const key = Buffer.concat([header, Buffer.from('rest')])
    expect(parseHostKeyType(key)).toBe('ssh-ed25519')
  })

  it('maps authentication failures to a Portuguese message', () => {
    const err = Object.assign(new Error('All configured authentication methods failed'), {
      level: 'client-authentication'
    })
    expect(formatSshClientError(err).message).toMatch(/Autenticação SSH recusada/)
  })
})
