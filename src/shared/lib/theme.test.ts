import { describe, expect, it } from 'vitest'
import {
  isThemePreference,
  msUntilAutomaticBoundary,
  NATIVE_CHROME,
  nativeChromeFor,
  nextAutomaticBoundary,
  resolveAutomaticTheme,
  resolveNativeTheme
} from './theme'

function local(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  return new Date(year, month - 1, day, hour, minute, second, ms)
}

describe('isThemePreference', () => {
  it('accepts dark, light, system and automatic', () => {
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('automatic')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isThemePreference('auto')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })
})

describe('resolveAutomaticTheme', () => {
  it('is light from 08:00 inclusive until 17:00 exclusive', () => {
    expect(resolveAutomaticTheme(local(2026, 10, 30, 0, 0))).toBe('dark')
    expect(resolveAutomaticTheme(local(2026, 10, 30, 7, 59, 59, 999))).toBe('dark')
    expect(resolveAutomaticTheme(local(2026, 10, 30, 8, 0))).toBe('light')
    expect(resolveAutomaticTheme(local(2026, 10, 30, 12, 0))).toBe('light')
    expect(resolveAutomaticTheme(local(2026, 10, 30, 16, 59, 59, 999))).toBe('light')
    expect(resolveAutomaticTheme(local(2026, 10, 30, 17, 0))).toBe('dark')
    expect(resolveAutomaticTheme(local(2026, 10, 30, 23, 59))).toBe('dark')
  })
})

describe('nextAutomaticBoundary', () => {
  it('points at the next 08:00 or 17:00 on the local clock', () => {
    expect(nextAutomaticBoundary(local(2026, 10, 30, 7, 59)).getTime()).toBe(
      local(2026, 10, 30, 8, 0).getTime()
    )
    expect(nextAutomaticBoundary(local(2026, 10, 30, 8, 0)).getTime()).toBe(
      local(2026, 10, 30, 17, 0).getTime()
    )
    expect(nextAutomaticBoundary(local(2026, 10, 30, 16, 59)).getTime()).toBe(
      local(2026, 10, 30, 17, 0).getTime()
    )
    expect(nextAutomaticBoundary(local(2026, 10, 30, 17, 0)).getTime()).toBe(
      local(2026, 10, 31, 8, 0).getTime()
    )
    expect(nextAutomaticBoundary(local(2026, 10, 31, 18, 0)).getTime()).toBe(
      local(2026, 11, 1, 8, 0).getTime()
    )
  })

  it('returns a positive delay until that boundary', () => {
    expect(msUntilAutomaticBoundary(local(2026, 10, 30, 7, 59))).toBe(60_000)
  })
})

describe('resolveNativeTheme', () => {
  it('follows the OS when preference is system', () => {
    expect(resolveNativeTheme('system', true)).toBe('dark')
    expect(resolveNativeTheme('system', false)).toBe('light')
  })

  it('ignores the OS when preference is explicit', () => {
    expect(resolveNativeTheme('light', true)).toBe('light')
    expect(resolveNativeTheme('dark', false)).toBe('dark')
  })

  it('follows the local clock when preference is automatic', () => {
    expect(resolveNativeTheme('automatic', true, local(2026, 10, 30, 12, 0))).toBe('light')
    expect(resolveNativeTheme('automatic', false, local(2026, 10, 30, 20, 0))).toBe('dark')
  })
})

describe('nativeChromeFor', () => {
  it('uses the light background so inactive traffic lights stay visible', () => {
    expect(nativeChromeFor('light', true).background).toBe(NATIVE_CHROME.light.background)
    expect(nativeChromeFor('system', false).overlayColor).toBe(NATIVE_CHROME.light.overlayColor)
    expect(nativeChromeFor('automatic', true, local(2026, 10, 30, 9, 0)).background).toBe(
      NATIVE_CHROME.light.background
    )
    expect(nativeChromeFor('automatic', false, local(2026, 10, 30, 21, 0)).background).toBe(
      NATIVE_CHROME.dark.background
    )
  })
})
