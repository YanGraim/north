import { describe, expect, it } from 'vitest'
import { serializeCell, serializeRow } from './serialize'

describe('serializeCell', () => {
  it('passes through primitives and null', () => {
    expect(serializeCell(null)).toBeNull()
    expect(serializeCell(undefined)).toBeNull()
    expect(serializeCell('a')).toBe('a')
    expect(serializeCell(1)).toBe(1)
    expect(serializeCell(true)).toBe(true)
  })

  it('stringifies bigint, Date, Buffer and objects', () => {
    expect(serializeCell(10n)).toBe('10')
    expect(serializeCell(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z')
    expect(serializeCell(Buffer.from([0xab, 0xcd]))).toBe('\\xabcd')
    expect(serializeCell({ a: 1 })).toBe('{"a":1}')
  })

  it('serializes a row by column names', () => {
    expect(serializeRow(['id', 'name'], { id: 1n, name: 'x' })).toEqual({ id: '1', name: 'x' })
  })
})
