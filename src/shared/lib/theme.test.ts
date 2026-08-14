import { describe, expect, it } from 'vitest'
import { isThemePreference, NATIVE_CHROME, nativeChromeFor, resolveNativeTheme } from './theme'

describe('isThemePreference', () => {
  it('accepts dark, light and system', () => {
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isThemePreference('auto')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
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
})

describe('nativeChromeFor', () => {
  it('uses the light background so inactive traffic lights stay visible', () => {
    expect(nativeChromeFor('light', true).background).toBe(NATIVE_CHROME.light.background)
    expect(nativeChromeFor('system', false).overlayColor).toBe(NATIVE_CHROME.light.overlayColor)
  })
})
