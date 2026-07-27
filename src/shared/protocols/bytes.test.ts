import { describe, expect, it } from 'vitest'
import { coerceBytes } from './bytes'

describe('coerceBytes', () => {
  it('accepts Uint8Array and ArrayBuffer', () => {
    expect(Array.from(coerceBytes(new Uint8Array([1, 2, 3])) ?? [])).toEqual([1, 2, 3])
    expect(Array.from(coerceBytes(new Uint8Array([9, 8]).buffer) ?? [])).toEqual([9, 8])
  })

  it('accepts ArrayBuffer views and number arrays', () => {
    const view = new DataView(new Uint8Array([4, 5]).buffer)
    expect(Array.from(coerceBytes(view) ?? [])).toEqual([4, 5])
    expect(Array.from(coerceBytes([7, 8, 9]) ?? [])).toEqual([7, 8, 9])
  })

  it('returns null for unsupported values', () => {
    expect(coerceBytes(null)).toBeNull()
    expect(coerceBytes('nope')).toBeNull()
  })
})
