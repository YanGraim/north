import { describe, expect, it } from 'vitest'
import { brandColorForEngine, resolveEngineBrand, usesCustomInventoryIcon } from './engine-brands'

describe('resolveEngineBrand', () => {
  it('returns a brand for known SQL/NoSQL engines', () => {
    expect(resolveEngineBrand('postgres')).toBe('postgres')
    expect(resolveEngineBrand('redis')).toBe('redis')
    expect(resolveEngineBrand('sqlite')).toBe('sqlite')
  })

  it('returns null for other or missing engines', () => {
    expect(resolveEngineBrand('other')).toBeNull()
    expect(resolveEngineBrand(null)).toBeNull()
    expect(resolveEngineBrand(undefined)).toBeNull()
  })
})

describe('usesCustomInventoryIcon', () => {
  it('uses a custom Lucide icon whenever one is saved, including database', () => {
    expect(usesCustomInventoryIcon('database')).toBe(true)
    expect(usesCustomInventoryIcon('globe')).toBe(true)
    expect(usesCustomInventoryIcon(null)).toBe(false)
    expect(usesCustomInventoryIcon(undefined)).toBe(false)
  })
})

describe('brandColorForEngine', () => {
  it('uses elevated dark colors for low-contrast marks', () => {
    expect(brandColorForEngine('mariadb', 'dark')).toBe('#0AA5C0')
    expect(brandColorForEngine('sqlite', 'dark')).toBe('#0F80CC')
  })

  it('uses official light-theme colors in light mode', () => {
    expect(brandColorForEngine('mariadb', 'light')).toBe('#003545')
    expect(brandColorForEngine('postgres', 'light')).toBe('#4169E1')
  })
})
