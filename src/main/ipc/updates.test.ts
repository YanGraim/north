import { describe, expect, it } from 'vitest'
import { isNewerVersion } from './updates'

describe('isNewerVersion', () => {
  it('returns true only when remote is greater', () => {
    expect(isNewerVersion('0.1.3', '0.1.2')).toBe(true)
    expect(isNewerVersion('0.2.0', '0.1.9')).toBe(true)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
  })

  it('returns false for equal or older remote versions', () => {
    expect(isNewerVersion('0.1.2', '0.1.3')).toBe(false)
    expect(isNewerVersion('0.1.3', '0.1.3')).toBe(false)
    expect(isNewerVersion('0.1.0', '0.1.3')).toBe(false)
  })

  it('tolerates a leading v', () => {
    expect(isNewerVersion('v0.1.4', '0.1.3')).toBe(true)
    expect(isNewerVersion('0.1.3', 'v0.1.3')).toBe(false)
  })
})
