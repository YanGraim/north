import { LigaturesAddon } from '@xterm/addon-ligatures/lib/addon-ligatures.mjs'
import type { Terminal } from '@xterm/xterm'

export type { LigaturesAddon }

/**
 * Loads the ligatures addon on a live terminal, or drops it.
 * `dispose` deregisters the character joiner, and xterm refreshes the viewport
 * from that call, so the session and the scrollback stay put.
 * `fontFeatureSettings: 'normal'` keeps the addon from writing a partial
 * `"calt" on`, which would turn other font features off. Joining still comes
 * from the addon; drawing uses `font-variant-ligatures` on `.xterm`, not the window.
 */
export function applyTerminalLigatures(
  term: Terminal,
  enabled: boolean,
  current: LigaturesAddon | null
): LigaturesAddon | null {
  if (!enabled) {
    current?.dispose()
    return null
  }
  if (current) return current
  const addon = new LigaturesAddon({ fontFeatureSettings: 'normal' })
  term.loadAddon(addon)
  return addon
}
