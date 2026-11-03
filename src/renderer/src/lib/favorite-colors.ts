import { ENTITY_COLORS } from './entity-colors'

export const MAX_FAVORITE_COLORS = 10

const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
const ENTITY_COLOR_SET: ReadonlySet<string> = new Set(ENTITY_COLORS)

/** `#RGB` / `#RRGGBB`, with or without `#`. Stored as `#` + six lowercase hex digits. */
export function normalizeHexColor(input: string): string | null {
  const digits = HEX_COLOR.exec(input.trim())?.[1]?.toLowerCase()
  if (!digits) return null
  if (digits.length === 3) {
    const red = digits[0]
    const green = digits[1]
    const blue = digits[2]
    if (!red || !green || !blue) return null
    return `#${red}${red}${green}${green}${blue}${blue}`
  }
  return `#${digits}`
}

function isEntityColor(color: string): boolean {
  return ENTITY_COLOR_SET.has(color)
}

/**
 * Prepends a custom color. Palette colors and invalid input leave the list as-is.
 * A repeat moves to the front. The 11th drops the oldest.
 */
export function rememberFavoriteColor(list: readonly string[], color: string): string[] {
  const normalized = normalizeHexColor(color)
  if (!normalized || isEntityColor(normalized)) return list as string[]

  const without = list.filter((item) => normalizeHexColor(item) !== normalized)
  const alreadyAtFront =
    list.length <= MAX_FAVORITE_COLORS &&
    list[0] === normalized &&
    without.length === list.length - 1
  if (alreadyAtFront) return list as string[]

  return [normalized, ...without].slice(0, MAX_FAVORITE_COLORS)
}

/** Drops one custom color. Invalid input and a missing color leave the list as-is. */
export function removeFavoriteColor(list: readonly string[], color: string): string[] {
  const normalized = normalizeHexColor(color)
  if (!normalized) return list as string[]
  const next = list.filter((item) => normalizeHexColor(item) !== normalized)
  return next.length === list.length ? (list as string[]) : next
}

/** Merge helper: drop invalid and palette entries, dedupe, keep the 10 newest. */
export function sanitizeFavoriteColors(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const strings = value.filter((item): item is string => typeof item === 'string')
  let next: string[] = []
  for (let index = strings.length - 1; index >= 0; index -= 1) {
    const item = strings[index]
    if (item === undefined) continue
    next = rememberFavoriteColor(next, item)
  }
  return next
}
