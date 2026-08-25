import { describe, expect, it } from 'vitest'
import {
  applyCharacterMaxLength,
  isCharacterDataType,
  parseSqliteCharacterMaximumLength
} from './sql-char-length'

describe('sqlite character length', () => {
  it('parses CHAR/VARCHAR and ignores DECIMAL', () => {
    expect(parseSqliteCharacterMaximumLength('CHAR(1)')).toBe(1)
    expect(parseSqliteCharacterMaximumLength('VARCHAR(1)')).toBe(1)
    expect(parseSqliteCharacterMaximumLength('NVARCHAR(10)')).toBe(10)
    expect(parseSqliteCharacterMaximumLength('DECIMAL(10,2)')).toBeNull()
    expect(parseSqliteCharacterMaximumLength('TEXT')).toBeNull()
  })

  it('recognizes character types', () => {
    expect(isCharacterDataType('character varying')).toBe(true)
    expect(isCharacterDataType('bpchar')).toBe(true)
    expect(isCharacterDataType('int')).toBe(false)
  })

  it('allows NULL prefixes on nullable CHAR(1)', () => {
    expect(applyCharacterMaxLength('N', 1, { nullable: true })).toBe('N')
    expect(applyCharacterMaxLength('NULL', 1, { nullable: true })).toBe('NULL')
    expect(applyCharacterMaxLength('AB', 1, { nullable: true })).toBe('A')
    expect(applyCharacterMaxLength('AB', 1, { nullable: false })).toBe('A')
    expect(applyCharacterMaxLength('NU', 1, { nullable: true, committing: true })).toBe('N')
  })
})
