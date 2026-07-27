import { describe, expect, it } from 'vitest'
import { matchesShortcut, SHORTCUTS, shortcutDisplayLabel } from './shortcuts'

describe('shortcuts', () => {
  it('registers command palette, sidebar, new connection and tab actions', () => {
    expect(SHORTCUTS.commandPalette.key).toBe('k')
    expect(SHORTCUTS.toggleSidebar.key).toBe('b')
    expect(SHORTCUTS.newConnection.key).toBe('n')
    expect(SHORTCUTS.closeTab.key).toBe('w')
    expect(SHORTCUTS.duplicateTab.shift).toBe(true)
  })

  it('matches mod+key combinations', () => {
    const event = {
      key: 'k',
      metaKey: true,
      ctrlKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(matchesShortcut(event, 'commandPalette')).toBe(true)
    expect(matchesShortcut({ ...event, key: 'n' } as KeyboardEvent, 'newConnection')).toBe(true)
    expect(matchesShortcut({ ...event, metaKey: false } as KeyboardEvent, 'commandPalette')).toBe(
      false
    )
  })

  it('formats display labels', () => {
    expect(shortcutDisplayLabel('toggleSidebar')).toMatch(/B$/)
  })
})
