import { describe, expect, it } from 'vitest'
import {
  resolveMiddleButtonAction,
  resolveTerminalPointerRole,
  terminalRightClickSelectsWord
} from './middle-button'

describe('resolveMiddleButtonAction', () => {
  it('copies when the terminal has a selection', () => {
    expect(resolveMiddleButtonAction(true)).toBe('copy')
  })

  it('pastes when the terminal has no selection', () => {
    expect(resolveMiddleButtonAction(false)).toBe('paste')
  })
})

describe('resolveTerminalPointerRole', () => {
  it('keeps copy or paste on the middle button by default', () => {
    expect(resolveTerminalPointerRole(1, false)).toBe('copy-paste')
    expect(resolveTerminalPointerRole(2, false)).toBe('menu')
  })

  it('swaps the roles when the right button copies or pastes', () => {
    expect(resolveTerminalPointerRole(2, true)).toBe('copy-paste')
    expect(resolveTerminalPointerRole(1, true)).toBe('menu')
  })

  it('ignores the left button and other buttons', () => {
    expect(resolveTerminalPointerRole(0, false)).toBeNull()
    expect(resolveTerminalPointerRole(0, true)).toBeNull()
    expect(resolveTerminalPointerRole(3, true)).toBeNull()
  })
})

describe('terminalRightClickSelectsWord', () => {
  it('selects a word only while the right button still opens the menu', () => {
    expect(terminalRightClickSelectsWord(false)).toBe(true)
    expect(terminalRightClickSelectsWord(true)).toBe(false)
  })
})
