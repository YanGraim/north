import { describe, expect, it } from 'vitest'
import { terminalPasteShortcutLabel } from './terminal-paste'

describe('terminal-paste', () => {
  it('reports platform-specific paste shortcut label', () => {
    expect(['⌘V', 'Ctrl+V']).toContain(terminalPasteShortcutLabel())
  })
})
