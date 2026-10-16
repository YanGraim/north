import { describe, expect, it } from 'vitest'
import { createRedactor, REDACTED } from './redact'

describe('createRedactor', () => {
  it('removes every known secret, including short-but-not-trivial ones', () => {
    const redact = createRedactor(['s3cr3t!', 'psk-value-123'])
    expect(redact('auth with s3cr3t! and psk-value-123 twice s3cr3t!')).toBe(
      `auth with ${REDACTED} and ${REDACTED} twice ${REDACTED}`
    )
  })

  it('ignores empty/very short secrets to avoid shredding logs', () => {
    const redact = createRedactor(['', 'a'])
    expect(redact('a normal line')).toBe('a normal line')
  })

  it('masks management password/username commands regardless of known secrets', () => {
    const redact = createRedactor([])
    expect(redact('password "Auth" "hunter2"')).toBe(`password "Auth" "${REDACTED}"`)
    expect(redact('password "Private Key" "pp"')).toBe(`password "Private Key" "${REDACTED}"`)
    expect(redact('username "Auth" "alice"')).toBe(`username "Auth" "${REDACTED}"`)
  })

  it('masks PEM bodies and openvpn static keys', () => {
    const redact = createRedactor([])
    const out = redact('-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----')
    expect(out).not.toContain('MIIabc')
    expect(out).toContain('BEGIN PRIVATE KEY')
  })

  it('escapes regex metacharacters in secrets', () => {
    const redact = createRedactor(['a.b*c(d'])
    expect(redact('x a.b*c(d y axbbbc(d')).toBe(`x ${REDACTED} y axbbbc(d`)
  })

  it('redacts longer secrets first when one contains another', () => {
    const redact = createRedactor(['pass', 'password123'])
    expect(redact('password123')).toBe(REDACTED)
  })
})
