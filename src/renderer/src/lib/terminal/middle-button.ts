/** Middle button copies a selection and pastes when the terminal has none. */
export function resolveMiddleButtonAction(hasSelection: boolean): 'copy' | 'paste' {
  return hasSelection ? 'copy' : 'paste'
}

export type TerminalPointerRole = 'copy-paste' | 'menu'

/**
 * Button 1 is the middle button, button 2 is the right button.
 * With `rightButtonCopies` off, the middle button copies or pastes and the right button opens the menu.
 */
export function resolveTerminalPointerRole(
  button: number,
  rightButtonCopies: boolean
): TerminalPointerRole | null {
  if (button === 1) return rightButtonCopies ? 'menu' : 'copy-paste'
  if (button === 2) return rightButtonCopies ? 'copy-paste' : 'menu'
  return null
}

/** Selecting a word on right click would copy that word instead of pasting. */
export function terminalRightClickSelectsWord(rightButtonCopies: boolean): boolean {
  return !rightButtonCopies
}
