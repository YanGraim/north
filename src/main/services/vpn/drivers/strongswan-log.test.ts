import { describe, expect, it } from 'vitest'
import { buildIpsecHelperInput, parseStrongswanLine } from './strongswan-log'

describe('parseStrongswanLine', () => {
  it.each([
    ['CHILD_SA cmd{1} established with SPIs c1_i 0a_o', { type: 'up' }],
    ['installing new virtual IP 10.10.20.5', { type: 'address', ip: '10.10.20.5' }],
    ['received NO_PROPOSAL_CHOSEN error notify', { type: 'no-proposal' }],
    ["XAuth authentication of 'grp.x' (myself) failed", { type: 'auth-failed' }],
    ['received AUTHENTICATION_FAILED notify error', { type: 'auth-failed' }],
    ['calculated HASH does not match HASH payload', { type: 'psk-mismatch' }]
  ])('%s', (line, event) => {
    expect(parseStrongswanLine(line)).toEqual(event)
  })
  it('retransmits exhausted → unreachable', () => {
    expect(parseStrongswanLine('giving up after 5 retransmits').type).toBe('unreachable')
  })
})

describe('buildIpsecHelperInput', () => {
  const base = { gateway: 'poly.fortidyndns.com', username: 'grp.x', psk: 'k', password: 'p' }
  it('defaults to one exact FortiClient proposal per phase (DH 5)', () => {
    const input = buildIpsecHelperInput(base)
    expect(input).toContain('ike=aes256-sha256-modp1536')
    expect(input).toContain('esp=aes256-sha1-modp1536')
    expect(input.endsWith('\n')).toBe(true)
  })
  it('refuses values that could become extra options or lines', () => {
    expect(() => buildIpsecHelperInput({ ...base, gateway: '--debug' })).toThrow()
    expect(() => buildIpsecHelperInput({ ...base, username: 'a b' })).toThrow()
    expect(() => buildIpsecHelperInput({ ...base, password: 'a\nhost=evil' })).toThrow()
  })

  it('flags XAuth credential prompts', () => {
    expect(
      parseStrongswanLine('parsed TRANSACTION request 123 [ HASH CPRQ(X_TYPE X_USER X_PWD) ]')
    ).toEqual({ type: 'xauth-request' })
    expect(
      parseStrongswanLine('generating TRANSACTION response 123 [ HASH CPRP(X_USER X_PWD) ]').type
    ).toBe('other')
  })
})
