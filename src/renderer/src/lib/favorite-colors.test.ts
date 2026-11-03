import { describe, expect, it } from 'vitest'
import { ENTITY_COLORS } from './entity-colors'
import {
  MAX_FAVORITE_COLORS,
  normalizeHexColor,
  rememberFavoriteColor,
  removeFavoriteColor,
  sanitizeFavoriteColors
} from './favorite-colors'

function swatch(index: number): string {
  return `#${index.toString(16).padStart(6, '0')}`
}

describe('normalizeHexColor', () => {
  it('stores #rgb, bare hex, and #rrggbb as six lowercase digits', () => {
    expect(normalizeHexColor('#abc')).toBe('#aabbcc')
    expect(normalizeHexColor('abc')).toBe('#aabbcc')
    expect(normalizeHexColor('#aabbcc')).toBe('#aabbcc')
    expect(normalizeHexColor('AABBCC')).toBe('#aabbcc')
    expect(normalizeHexColor('#AABBCC')).toBe('#aabbcc')
    expect(normalizeHexColor('  #AbC  ')).toBe('#aabbcc')
    expect(normalizeHexColor('#123')).toBe('#112233')
  })

  it('rejects names, alpha, hsl, empty, and lengths other than 3 or 6', () => {
    expect(normalizeHexColor('red')).toBeNull()
    expect(normalizeHexColor('#abcd')).toBeNull()
    expect(normalizeHexColor('#rgba')).toBeNull()
    expect(normalizeHexColor('#aabbccdd')).toBeNull()
    expect(normalizeHexColor('#rrggbbaa')).toBeNull()
    expect(normalizeHexColor('')).toBeNull()
    expect(normalizeHexColor('   ')).toBeNull()
    expect(normalizeHexColor('hsl(0, 0%, 0%)')).toBeNull()
    expect(normalizeHexColor('rgb(0, 0, 0)')).toBeNull()
    expect(normalizeHexColor('#12')).toBeNull()
    expect(normalizeHexColor('#12345')).toBeNull()
    expect(normalizeHexColor('#1234567')).toBeNull()
    expect(normalizeHexColor('#gg0000')).toBeNull()
    expect(normalizeHexColor('##abc')).toBeNull()
  })
})

describe('rememberFavoriteColor', () => {
  it('prepends a custom color and expands short hex', () => {
    expect(rememberFavoriteColor([], '#abc')).toEqual(['#aabbcc'])
    expect(rememberFavoriteColor([], 'abc')).toEqual(['#aabbcc'])
    expect(rememberFavoriteColor(['#111111'], 'AABBCC')).toEqual(['#aabbcc', '#111111'])
  })

  it('moves a repeat to the front without growing the list', () => {
    const list = ['#111111', '#222222', '#333333']
    expect(rememberFavoriteColor(list, '#333333')).toEqual(['#333333', '#111111', '#222222'])
    expect(rememberFavoriteColor(['#111111', '#AABBCC'], '#aabbcc')).toEqual(['#aabbcc', '#111111'])
  })

  it('returns the same list for palette colors and invalid input', () => {
    const list = ['#112233']
    expect(rememberFavoriteColor(list, 'red')).toBe(list)
    expect(rememberFavoriteColor(list, '#abcd')).toBe(list)
    expect(rememberFavoriteColor(list, '#aabbccdd')).toBe(list)
    expect(rememberFavoriteColor(list, '')).toBe(list)
    expect(rememberFavoriteColor(list, '   ')).toBe(list)
    for (const color of ENTITY_COLORS) {
      expect(rememberFavoriteColor(list, color)).toBe(list)
      expect(rememberFavoriteColor(list, color.toUpperCase())).toBe(list)
      expect(rememberFavoriteColor(list, color.slice(1))).toBe(list)
    }
  })

  it('drops the oldest color past the cap of 10', () => {
    const existing = Array.from({ length: MAX_FAVORITE_COLORS }, (_, index) => swatch(index + 1))
    const next = rememberFavoriteColor(existing, swatch(11))
    expect(next).toHaveLength(MAX_FAVORITE_COLORS)
    expect(next[0]).toBe(swatch(11))
    expect(next[1]).toBe(swatch(1))
    expect(next[9]).toBe(swatch(9))
    expect(next).not.toContain(swatch(10))
  })

  it('keeps every color when a repeat in a full list moves to the front', () => {
    const existing = Array.from({ length: MAX_FAVORITE_COLORS }, (_, index) => swatch(index + 1))
    expect(rememberFavoriteColor(existing, swatch(10))).toEqual([
      swatch(10),
      ...existing.slice(0, 9)
    ])
  })

  it('does not mutate the input list', () => {
    const list = ['#000001', '#000002']
    const copy = [...list]
    rememberFavoriteColor(list, '#000003')
    expect(list).toEqual(copy)
  })
})

describe('removeFavoriteColor', () => {
  it('removes a normalized match and ignores invalid or missing colors', () => {
    const list = ['#111111', '#aabbcc']
    expect(removeFavoriteColor(list, '#ABC')).toEqual(['#111111'])
    expect(removeFavoriteColor(list, 'red')).toBe(list)
    expect(removeFavoriteColor(list, '#333333')).toBe(list)
  })
})

describe('sanitizeFavoriteColors', () => {
  it('drops junk, palette colors, and duplicates, then caps at 10', () => {
    expect(sanitizeFavoriteColors(undefined)).toEqual([])
    expect(sanitizeFavoriteColors(null)).toEqual([])
    expect(sanitizeFavoriteColors('nope')).toEqual([])
    expect(
      sanitizeFavoriteColors(['#ABC', 'red', '#aabbcc', ENTITY_COLORS[0], 12, '#111111'])
    ).toEqual(['#aabbcc', '#111111'])
    expect(sanitizeFavoriteColors(['#222222', '#111111', '#222222'])).toEqual([
      '#222222',
      '#111111'
    ])

    const many = Array.from({ length: 12 }, (_, index) => swatch(index + 1))
    const sanitized = sanitizeFavoriteColors([ENTITY_COLORS[0], ...many, 'red'])
    expect(sanitized).toHaveLength(MAX_FAVORITE_COLORS)
    expect(sanitized[0]).toBe(swatch(1))
    expect(sanitized[9]).toBe(swatch(10))
    expect(sanitized).not.toContain(ENTITY_COLORS[0])
    expect(sanitized).not.toContain(swatch(11))
    expect(sanitized).not.toContain(swatch(12))
  })
})
