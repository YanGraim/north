export type ThemePreference = 'dark' | 'light' | 'system' | 'automatic'
export type ResolvedTheme = 'dark' | 'light'

/** Local clock window for `automatic`: light from 08:00 inclusive until 17:00 exclusive. */
export const AUTOMATIC_LIGHT_START_HOUR = 8
export const AUTOMATIC_LIGHT_END_HOUR = 17

/** Used when the next boundary is not in the future, so a timer cannot spin. */
const AUTOMATIC_BOUNDARY_RETRY_MS = 1000

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
  return value === 'dark' || value === 'light' || value === 'system' || value === 'automatic'
}

/** Light during the local daytime window; dark otherwise. Ignores the OS theme. */
export function resolveAutomaticTheme(now: Date): ResolvedTheme {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const start = AUTOMATIC_LIGHT_START_HOUR * 60
  const end = AUTOMATIC_LIGHT_END_HOUR * 60
  return minutes >= start && minutes < end ? 'light' : 'dark'
}

function atLocalHour(now: Date, dayOffset: number, hour: number): Date {
  const next = new Date(now)
  next.setDate(next.getDate() + dayOffset)
  next.setHours(hour, 0, 0, 0)
  return next
}

/** Next 08:00 or 17:00 on the local clock, strictly after `now` in the normal case. */
export function nextAutomaticBoundary(now: Date): Date {
  const start = atLocalHour(now, 0, AUTOMATIC_LIGHT_START_HOUR)
  const end = atLocalHour(now, 0, AUTOMATIC_LIGHT_END_HOUR)
  if (now < start) return start
  if (now < end) return end
  return atLocalHour(now, 1, AUTOMATIC_LIGHT_START_HOUR)
}

export function msUntilAutomaticBoundary(now: Date = new Date()): number {
  const delay = nextAutomaticBoundary(now).getTime() - now.getTime()
  return delay > 0 ? delay : AUTOMATIC_BOUNDARY_RETRY_MS
}

export function resolveNativeTheme(
  preference: ThemePreference,
  systemIsDark: boolean,
  now: Date = new Date()
): ResolvedTheme {
  if (preference === 'system') {
    return systemIsDark ? 'dark' : 'light'
  }
  if (preference === 'automatic') return resolveAutomaticTheme(now)
  return preference
}

export function nativeChromeFor(
  preference: ThemePreference,
  systemIsDark: boolean,
  now: Date = new Date()
) {
  const resolved = resolveNativeTheme(preference, systemIsDark, now)
  return {
    resolved,
    overlayHeight: TITLEBAR_OVERLAY_HEIGHT,
    ...NATIVE_CHROME[resolved]
  }
}
