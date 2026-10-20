import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { loadMasterKey, open, seal } from './envelope'

const key = randomBytes(32)

describe('envelope encryption', () => {
  it('round-trips a secret', () => {
    const sealed = seal(key, 'hunter2', 'secret-1')
    expect(open(key, sealed, 'secret-1')).toBe('hunter2')
  })

  it('never stores the plaintext and uses a fresh data key each time', () => {
    const a = seal(key, 'hunter2', 'secret-1')
    const b = seal(key, 'hunter2', 'secret-1')
    expect(a.ciphertext).not.toContain('hunter2')
    expect(a.wrappedKey).not.toBe(b.wrappedKey)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('is bound to the secret id (a row copied to another id does not open)', () => {
    const sealed = seal(key, 'hunter2', 'secret-1')
    expect(() => open(key, sealed, 'secret-2')).toThrow()
  })

  it('rejects a different master key', () => {
    const sealed = seal(key, 'hunter2', 'secret-1')
    expect(() => open(randomBytes(32), sealed, 'secret-1')).toThrow()
  })

  it('rejects tampered ciphertext', () => {
    const sealed = seal(key, 'hunter2', 'secret-1')
    const [iv, tag, data] = sealed.ciphertext.split('.')
    const flipped = Buffer.from(data, 'base64')
    flipped[0] ^= 1
    expect(() =>
      open(
        key,
        { ...sealed, ciphertext: [iv, tag, flipped.toString('base64')].join('.') },
        'secret-1'
      )
    ).toThrow()
  })

  it('handles unicode', () => {
    const sealed = seal(key, 'sénha 🔑', 'x')
    expect(open(key, sealed, 'x')).toBe('sénha 🔑')
  })
})

describe('loadMasterKey', () => {
  it('reads a base64 key with 32 bytes', () => {
    const raw = randomBytes(32)
    expect(loadMasterKey({ NORTH_MASTER_KEY: raw.toString('base64') })?.equals(raw)).toBe(true)
  })

  it('reads the key from a file', () => {
    const raw = randomBytes(32)
    const read = (path: string) => {
      expect(path).toBe('/run/secrets/north-key')
      return `${raw.toString('base64')}\n`
    }
    expect(
      loadMasterKey({ NORTH_MASTER_KEY_FILE: '/run/secrets/north-key' }, read)?.equals(raw)
    ).toBe(true)
  })

  it('returns null when no key is configured', () => {
    expect(loadMasterKey({})).toBeNull()
  })

  it('rejects a key with the wrong size', () => {
    expect(() => loadMasterKey({ NORTH_MASTER_KEY: randomBytes(16).toString('base64') })).toThrow(
      /32 bytes/
    )
  })
})
