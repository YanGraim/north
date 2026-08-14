export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

/** Native window chrome — keep in sync with `html.dark` / `html.light` tokens. */
export const NATIVE_CHROME = {
  dark: {
    background: '#0a0e17',
    overlayColor: '#0f1520',
    overlaySymbol: '#e8edf7'
  },
  light: {
    background: '#f1f5f9',
    overlayColor: '#ffffff',
    overlaySymbol: '#0f172a'
  }
} as const

export const TITLEBAR_OVERLAY_HEIGHT = 44

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}

export function resolveNativeTheme(
  preference: ThemePreference,
  systemIsDark: boolean
): ResolvedTheme {
  if (preference === 'system') {
    return systemIsDark ? 'dark' : 'light'
  }
  return preference
}

export function nativeChromeFor(preference: ThemePreference, systemIsDark: boolean) {
  const resolved = resolveNativeTheme(preference, systemIsDark)
  return {
    resolved,
    overlayHeight: TITLEBAR_OVERLAY_HEIGHT,
    ...NATIVE_CHROME[resolved]
  }
}
