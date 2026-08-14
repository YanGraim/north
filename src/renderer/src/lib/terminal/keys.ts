import { isApplePlatform } from '@renderer/lib/platform'

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
  | { type: 'cut' }
  | { type: 'paste' }
  | { type: 'selectAll' }
  | { type: 'deleteSelection' }
  | { type: 'openFind' }
  | { type: 'closeFind' }
  | { type: 'clearSelection' }
  /** Explicitly inject ESC (`\\x1b`) into the PTY; do not rely on xterm key encoding. */
  | { type: 'sendEscape' }
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
 * Select-all uses the platform primary modifier only so Mac Ctrl+A still reaches
 * the shell (beginning of line) while ⌘A selects the current logical line.
 */
function isSelectAllModKey(event: TerminalKeyEvent, platform?: string): boolean {
  if (event.key.toLowerCase() !== 'a' || event.shiftKey) return false
  if (isApplePlatform(platform)) return event.metaKey && !event.ctrlKey
  return event.ctrlKey && !event.metaKey
}

/**
 * Pure key policy for the terminal. Returns what North should do;
 * the attach layer maps actions to xterm / clipboard side effects.
 */
export function resolveTerminalKeyAction(
  event: TerminalKeyEvent,
  ctx: TerminalKeyContext,
  platform?: string
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

  if (isModKey(event, 'x')) {
    return ctx.hasSelection ? { type: 'cut' } : { type: 'passthrough' }
  }

  if (isModKey(event, 'v') || (event.shiftKey && event.key === 'Insert')) {
    return { type: 'paste' }
  }

  if (isSelectAllModKey(event, platform)) return { type: 'selectAll' }
  if (isModKey(event, 'f')) return { type: 'openFind' }

  if (
    ctx.hasSelection &&
    !hasPrimaryModifier(event) &&
    (event.key === 'Backspace' || event.key === 'Delete')
  ) {
    return { type: 'deleteSelection' }
  }

  if (event.key === 'Escape') {
    return ctx.hasSelection ? { type: 'clearSelection' } : { type: 'sendEscape' }
  }

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
