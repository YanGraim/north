import { resolveMonoFontStack } from './mono-font'

export const APP_FONT_FAMILIES = [
  'inter',
  'segoe-ui',
  'roboto',
  'open-sans',
  'outfit',
  'montserrat',
  'ubuntu',
  'system',
  'jetbrains-mono',
  'fira-code'
] as const

export type AppFontFamily = (typeof APP_FONT_FAMILIES)[number]

export const DEFAULT_APP_FONT_FAMILY: AppFontFamily = 'inter'

const APP_FONT_FAMILY_SET: ReadonlySet<string> = new Set(APP_FONT_FAMILIES)

const SANS_FALLBACK = '"Segoe UI", sans-serif'

type ProportionalAppFont = Exclude<AppFontFamily, 'jetbrains-mono' | 'fira-code'>

const PROPORTIONAL_STACKS: Record<ProportionalAppFont, string> = {
  inter: `"Inter", ${SANS_FALLBACK}`,
  'segoe-ui': '"Segoe UI", sans-serif',
  roboto: `"Roboto", ${SANS_FALLBACK}`,
  'open-sans': `"Open Sans", ${SANS_FALLBACK}`,
  outfit: `"Outfit", ${SANS_FALLBACK}`,
  montserrat: `"Montserrat", ${SANS_FALLBACK}`,
  ubuntu: `"Ubuntu", ${SANS_FALLBACK}`,
  system: 'ui-sans-serif, "SF Pro", "Segoe UI", system-ui, sans-serif'
}

export function sanitizeAppFontFamily(value: unknown): AppFontFamily {
  if (typeof value === 'string' && APP_FONT_FAMILY_SET.has(value)) {
    return value as AppFontFamily
  }
  return DEFAULT_APP_FONT_FAMILY
}

/** Interface family. The two mono faces reuse the terminal stack so the files stay in one place. */
export function resolveAppFontStack(family: unknown): string {
  const safeFamily = sanitizeAppFontFamily(family)
  if (safeFamily === 'jetbrains-mono' || safeFamily === 'fira-code') {
    return resolveMonoFontStack(safeFamily, false)
  }
  return PROPORTIONAL_STACKS[safeFamily]
}
