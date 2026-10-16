import { describe, expect, it } from 'vitest'
import { buildFortiConfig, parseFortiLine } from './openfortivpn-log'

const DIGEST = 'a'.repeat(64)

describe('parseFortiLine', () => {
  it.each([
    ['INFO:   Tunnel is up and running.', { type: 'up' }],
    [
      'INFO:   Got addresses: [10.212.134.200], ns [10.0.0.1, 0.0.0.0]',
      { type: 'address', ip: '10.212.134.200' }
    ],
    [
      'ERROR:  Could not authenticate to gateway. Please check the password, client certificate, etc.',
      { type: 'auth-failed' }
    ],
    [
      'ERROR:  Gateway certificate validation failed, and the certificate digest is not in the local whitelist. If you trust it, rerun with:',
      { type: 'cert-untrusted' }
    ],
    [`ERROR:      --trusted-cert ${DIGEST}`, { type: 'cert-digest', digest: DIGEST }],
    [
      'ERROR:  connect: Operation timed out',
      { type: 'error', message: 'connect: Operation timed out' }
    ],
    ['DEBUG:  whatever', { type: 'other', line: 'DEBUG:  whatever' }]
  ])('%s', (line, expected) => {
    expect(parseFortiLine(line)).toEqual(expected)
  })
})

describe('buildFortiConfig', () => {
  it('writes the openfortivpn config, with trusted cert and realm when present', () => {
    expect(
      buildFortiConfig({
        gateway: '179.190.99.2',
        port: 4433,
        username: 'grp.yan',
        password: 'p w',
        trustedCert: DIGEST
      })
    ).toBe(
      `host = 179.190.99.2\nport = 4433\nusername = grp.yan\npassword = p w\ntrusted-cert = ${DIGEST}\n`
    )
  })

  it('rejects line breaks (would inject options like pppd-plugin)', () => {
    expect(() =>
      buildFortiConfig({
        gateway: 'g',
        port: 443,
        username: 'u',
        password: 'x\npppd-plugin = /tmp/evil.so'
      })
    ).toThrow()
  })
})
