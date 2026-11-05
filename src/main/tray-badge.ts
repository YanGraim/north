/**
 * The tray glyph while a VPN is up: one green ellipse in the bottom-right corner.
 * Pure, so the pixels are tested without Electron.
 *
 * Green matches the opaque pixel of resources/tray/dot-on.png (#22c55e), the same
 * "up" mark the menu already draws. The window dot uses Tailwind emerald-500, close
 * but not this pixel.
 */
export const VPN_BADGE_GREEN = { r: 34, g: 197, b: 94 } as const

const RING = 1
const RING_ALPHA = 0.7

/** macOS menu-bar glyph (template). Windows and Linux keep the colored tray icon. */
export function trayBadgeUsesTemplate(platform: string): boolean {
  return platform === 'darwin'
}

/**
 * How to recolor the N before the ellipse. `keep` leaves the colored icon alone.
 * On macOS the badged image cannot be a template, so the N is black or white for the
 * system menu bar (`AppleInterfaceStyle`), not for the app theme.
 */
export function trayBadgeGlyph(
  platform: string,
  appleInterfaceStyle: string
): 'keep' | 'black' | 'white' {
  if (!trayBadgeUsesTemplate(platform)) return 'keep'
  return appleInterfaceStyle === 'Dark' ? 'white' : 'black'
}

/** Forces the glyph color and leaves alpha alone, so antialiasing survives. */
export function tintGlyph(rgba: Uint8Array, color: { r: number; g: number; b: number }): void {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue
    rgba[i] = color.r
    rgba[i + 1] = color.g
    rgba[i + 2] = color.b
  }
}

function coverage(edge: number): number {
  if (edge >= 0.5) return 1
  if (edge <= -0.5) return 0
  return edge + 0.5
}

function byte(n: number): number {
  if (n < 0) return 0
  if (n > 255) return 255
  return Math.round(n)
}

function blend(rgba: Uint8Array, i: number, r: number, g: number, b: number, alpha: number): void {
  if (alpha <= 0) return
  const srcA = alpha > 1 ? 1 : alpha
  const dstA = rgba[i + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return
  const keep = (dstA * (1 - srcA)) / outA
  const take = srcA / outA
  rgba[i] = byte(r * take + rgba[i] * keep)
  rgba[i + 1] = byte(g * take + rgba[i + 1] * keep)
  rgba[i + 2] = byte(b * take + rgba[i + 2] * keep)
  rgba[i + 3] = byte(outA * 255)
}

/** Paints into `rgba` (width * height * 4). One ellipse, bottom-right, whatever the count of VPNs. */
export function paintVpnBadge(rgba: Uint8Array, width: number, height: number): void {
  const radius = Math.max(2.2, Math.min(width, height) * 0.18)
  const cx = width - radius - 0.6
  const cy = height - radius - 0.6
  const { r, g, b } = VPN_BADGE_GREEN
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const fill = coverage(radius - dist)
      const ring = coverage(radius + RING - dist) * (1 - fill)
      if (fill <= 0 && ring <= 0) continue
      const i = (y * width + x) * 4
      if (ring > 0) blend(rgba, i, 0, 0, 0, ring * RING_ALPHA)
      if (fill > 0) blend(rgba, i, r, g, b, fill)
    }
  }
}
