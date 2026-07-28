import { describe, expect, it } from 'vitest'
import {
  isApplePlatform,
  terminalCopyShortcutLabel,
  terminalFindShortcutLabel,
  terminalModKeyLabel,
  terminalPasteShortcutLabel,
  terminalSelectAllShortcutLabel
} from './clipboard'
import {
  resolveTerminalKeyAction,
  shouldConsumeTerminalKeyAction,
  type TerminalKeyEvent
} from './keys'

function keyEvent(
  partial: Partial<TerminalKeyEvent> & Pick<TerminalKeyEvent, 'key'>
): TerminalKeyEvent {
  return {
    type: 'keydown',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...partial
  }
}

describe('terminal clipboard labels', () => {
  it('detects Apple platforms', () => {
    expect(isApplePlatform('MacIntel')).toBe(true)
    expect(isApplePlatform('iPhone')).toBe(true)
    expect(isApplePlatform('Win32')).toBe(false)
    expect(isApplePlatform('Linux x86_64')).toBe(false)
  })

  it('builds platform-specific shortcut labels', () => {
    expect(terminalModKeyLabel('MacIntel')).toBe('⌘')
    expect(terminalModKeyLabel('Win32')).toBe('Ctrl')
    expect(terminalPasteShortcutLabel('MacIntel')).toBe('⌘V')
    expect(terminalPasteShortcutLabel('Win32')).toBe('Ctrl+V')
    expect(terminalCopyShortcutLabel('MacIntel')).toBe('⌘C')
    expect(terminalCopyShortcutLabel('Linux x86_64')).toBe('Ctrl+C')
    expect(terminalSelectAllShortcutLabel('MacIntel')).toBe('⌘A')
    expect(terminalFindShortcutLabel('Win32')).toBe('Ctrl+F')
  })
})

describe('resolveTerminalKeyAction', () => {
  it('copies only when there is a selection on mod+C', () => {
    const withSelection = resolveTerminalKeyAction(keyEvent({ key: 'c', metaKey: true }), {
      hasSelection: true,
      findOpen: false
    })
    expect(withSelection).toEqual({ type: 'copy' })
    expect(shouldConsumeTerminalKeyAction(withSelection)).toBe(true)

    const withoutSelection = resolveTerminalKeyAction(keyEvent({ key: 'c', ctrlKey: true }), {
      hasSelection: false,
      findOpen: false
    })
    expect(withoutSelection).toEqual({ type: 'passthrough' })
    expect(shouldConsumeTerminalKeyAction(withoutSelection)).toBe(false)
  })

  it('handles paste via mod+V and Shift+Insert', () => {
    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'v', metaKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'paste' })

    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'Insert', shiftKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'paste' })
  })

  it('handles select-all, find, escape and scroll shortcuts', () => {
    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'a', ctrlKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'selectAll' })

    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'f', metaKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'openFind' })

    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'Escape' }), {
        hasSelection: true,
        findOpen: false
      })
    ).toEqual({ type: 'clearSelection' })

    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'PageUp', shiftKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'scrollPages', delta: -1 })

    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'PageDown', shiftKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'scrollPages', delta: 1 })

    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'Home', metaKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'scrollToTop' })

    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'End', ctrlKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'scrollToBottom' })
  })

  it('blocks PTY input while find is open except find shortcuts', () => {
    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'Escape' }), {
        hasSelection: false,
        findOpen: true
      })
    ).toEqual({ type: 'closeFind' })

    expect(
      resolveTerminalKeyAction(keyEvent({ key: 'f', metaKey: true }), {
        hasSelection: false,
        findOpen: true
      })
    ).toEqual({ type: 'openFind' })

    const blocked = resolveTerminalKeyAction(keyEvent({ key: 'x' }), {
      hasSelection: false,
      findOpen: true
    })
    expect(blocked).toEqual({ type: 'block' })
    expect(shouldConsumeTerminalKeyAction(blocked)).toBe(true)

    const blockedPaste = resolveTerminalKeyAction(keyEvent({ key: 'v', metaKey: true }), {
      hasSelection: false,
      findOpen: true
    })
    expect(blockedPaste).toEqual({ type: 'block' })
  })

  it('ignores non-keydown events', () => {
    expect(
      resolveTerminalKeyAction(keyEvent({ type: 'keyup', key: 'v', metaKey: true }), {
        hasSelection: false,
        findOpen: false
      })
    ).toEqual({ type: 'passthrough' })
  })
})
