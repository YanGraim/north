import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodePng, encodePng } from './png-rgba'
import {
  paintVpnBadge,
  tintGlyph,
  trayBadgeGlyph,
  trayBadgeUsesTemplate,
  VPN_BADGE_GREEN
} from './tray-badge'

const asset = (name: string) => readFileSync(join(process.cwd(), 'resources/tray', name))

function pixel(rgba: Uint8Array, width: number, x: number, y: number): number[] {
  const i = (y * width + x) * 4
  return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]]
}

const GREEN = [VPN_BADGE_GREEN.r, VPN_BADGE_GREEN.g, VPN_BADGE_GREEN.b, 255]

describe('png rgba', () => {
  it('round-trips a small image', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 128, 34, 197, 94, 0])
    const back = decodePng(encodePng({ width: 2, height: 2, rgba }))
    expect(back).toMatchObject({ width: 2, height: 2 })
    expect(Array.from(back.rgba)).toEqual(Array.from(rgba))
  })

  it('reads the menu dot as #22c55e, which the tray ellipse repeats', () => {
    const dot = decodePng(asset('dot-on.png'))
    expect(dot).toMatchObject({ width: 16, height: 16 })
    expect(pixel(dot.rgba, 16, 8, 8)).toEqual(GREEN)
    expect(pixel(dot.rgba, 16, 0, 0)[3]).toBe(0)
  })
})

describe('paintVpnBadge', () => {
  it('puts the ellipse in the bottom-right and leaves the opposite corner', () => {
    const rgba = new Uint8Array(16 * 16 * 4)
    paintVpnBadge(rgba, 16, 16)
    expect(pixel(rgba, 16, 0, 0)).toEqual([0, 0, 0, 0])
    expect(pixel(rgba, 16, 8, 2)).toEqual([0, 0, 0, 0])
    expect(pixel(rgba, 16, 13, 13)).toEqual(GREEN)
  })

  it('keeps the colored N on the Windows/Linux icon', () => {
    const icon = decodePng(asset('tray.png'))
    const n = pixel(icon.rgba, icon.width, 6, 6)
    expect(n[0]).toBeGreaterThan(200)
    expect(n[1]).toBeGreaterThan(200)
    expect(n[2]).toBeGreaterThan(200)
    const copy = new Uint8Array(icon.rgba)
    paintVpnBadge(copy, icon.width, icon.height)
    expect(pixel(copy, icon.width, 6, 6)).toEqual(n)
    expect(pixel(copy, icon.width, 13, 13)).toEqual(GREEN)
  })

  it('paints the retina asset too, still one ellipse', () => {
    const icon = decodePng(asset('tray@2x.png'))
    const copy = new Uint8Array(icon.rgba)
    paintVpnBadge(copy, icon.width, icon.height)
    expect(pixel(copy, icon.width, 26, 26)).toEqual(GREEN)
    expect(pixel(copy, icon.width, 4, 4)).toEqual(pixel(icon.rgba, icon.width, 4, 4))
  })

  it('tints the macOS N and still paints green on top', () => {
    const icon = decodePng(asset('trayTemplate.png'))
    const rgba = new Uint8Array(icon.rgba)
    tintGlyph(rgba, { r: 255, g: 255, b: 255 })
    paintVpnBadge(rgba, icon.width, icon.height)
    const glyph = pixel(rgba, icon.width, 3, 8)
    expect(glyph[0]).toBe(255)
    expect(glyph[1]).toBe(255)
    expect(glyph[2]).toBe(255)
    expect(glyph[3]).toBeGreaterThan(200)
    expect(pixel(rgba, icon.width, 14, 14)).toEqual(GREEN)
  })
})

describe('trayBadgeGlyph', () => {
  it('keeps the colored icon off macOS and follows the system menu bar there', () => {
    expect(trayBadgeUsesTemplate('win32')).toBe(false)
    expect(trayBadgeUsesTemplate('linux')).toBe(false)
    expect(trayBadgeUsesTemplate('darwin')).toBe(true)
    expect(trayBadgeGlyph('win32', 'Dark')).toBe('keep')
    expect(trayBadgeGlyph('linux', '')).toBe('keep')
    expect(trayBadgeGlyph('darwin', 'Dark')).toBe('white')
    expect(trayBadgeGlyph('darwin', '')).toBe('black')
    expect(trayBadgeGlyph('darwin', 'Light')).toBe('black')
  })
})
