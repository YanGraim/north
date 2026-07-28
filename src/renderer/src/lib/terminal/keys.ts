export type TerminalKeyEvent = {
  type: string
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

export type TerminalKeyContext = {
  hasSelection: boolean
  findOpen: boolean
}

export type TerminalKeyAction =
  | { type: 'passthrough' }
  | { type: 'block' }
  | { type: 'copy' }
  | { type: 'paste' }
  | { type: 'selectAll' }
  | { type: 'openFind' }
  | { type: 'closeFind' }
  | { type: 'clearSelection' }
  | { type: 'scrollPages'; delta: number }
  | { type: 'scrollToTop' }
  | { type: 'scrollToBottom' }

function hasPrimaryModifier(event: TerminalKeyEvent): boolean {
  return event.ctrlKey || event.metaKey
}

function isModKey(event: TerminalKeyEvent, key: string): boolean {
  return hasPrimaryModifier(event) && event.key.toLowerCase() === key && !event.shiftKey
}

/**
 * Pure key policy for the terminal. Returns what North should do;
 * the attach layer maps actions to xterm / clipboard side effects.
 */
export function resolveTerminalKeyAction(
  event: TerminalKeyEvent,
  ctx: TerminalKeyContext
): TerminalKeyAction {
  if (event.type !== 'keydown') return { type: 'passthrough' }

  if (ctx.findOpen) {
    if (event.key === 'Escape') return { type: 'closeFind' }
    if (isModKey(event, 'f')) return { type: 'openFind' }
    return { type: 'block' }
  }

  if (isModKey(event, 'c')) {
    return ctx.hasSelection ? { type: 'copy' } : { type: 'passthrough' }
  }

  if (isModKey(event, 'v') || (event.shiftKey && event.key === 'Insert')) {
    return { type: 'paste' }
  }

  if (isModKey(event, 'a')) return { type: 'selectAll' }
  if (isModKey(event, 'f')) return { type: 'openFind' }

  if (event.key === 'Escape') return { type: 'clearSelection' }

  if (event.shiftKey && !hasPrimaryModifier(event) && event.key === 'PageUp') {
    return { type: 'scrollPages', delta: -1 }
  }
  if (event.shiftKey && !hasPrimaryModifier(event) && event.key === 'PageDown') {
    return { type: 'scrollPages', delta: 1 }
  }

  if (hasPrimaryModifier(event) && !event.shiftKey && event.key === 'Home') {
    return { type: 'scrollToTop' }
  }
  if (hasPrimaryModifier(event) && !event.shiftKey && event.key === 'End') {
    return { type: 'scrollToBottom' }
  }

  return { type: 'passthrough' }
}

/** Whether the action should be consumed (not forwarded to the PTY). */
export function shouldConsumeTerminalKeyAction(action: TerminalKeyAction): boolean {
  return action.type !== 'passthrough'
}
