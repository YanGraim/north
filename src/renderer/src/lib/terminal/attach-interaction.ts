import {
  buildDeleteSelectionSequence,
  canClickToMove,
  getCursorBufferPos,
  getLogicalLineBounds,
  isInLogicalLine,
  resolveClickToMoveSequence,
  selectLogicalLineOrAll
} from '@renderer/lib/terminal/click-to-move'
import {
  attachNativePasteHandler,
  copyTerminalSelection,
  pasteClipboardIntoTerminal
} from '@renderer/lib/terminal/clipboard'
import {
  resolveTerminalKeyAction,
  shouldConsumeTerminalKeyAction
} from '@renderer/lib/terminal/keys'
import { attachWebLinks } from '@renderer/lib/terminal/links'
import {
  resolveMiddleButtonAction,
  resolveTerminalPointerRole,
  terminalRightClickSelectsWord
} from '@renderer/lib/terminal/middle-button'
import {
  clientPointToViewportCell,
  getXtermScreenElement,
  viewportCellToBufferPos
} from '@renderer/lib/terminal/mouse-cell'
import { attachCopyOnSelect } from '@renderer/lib/terminal/selection'
import { BrowserClipboardProvider, ClipboardAddon } from '@xterm/addon-clipboard'
import { SearchAddon } from '@xterm/addon-search'
import type { Terminal } from '@xterm/xterm'

const DRAG_THRESHOLD_PX = 4

export type AttachTerminalInteractionOptions = {
  term: Terminal
  container: HTMLElement
  getCopyOnSelect: () => boolean
  /** When true, the right button copies or pastes and the middle button opens the menu. */
  getRightButtonCopies: () => boolean
  isFindOpen: () => boolean
  onOpenFind: () => void
  onCloseFind: () => void
  onLinkChange?: (url: string | null) => void
  onSelectionChange?: (hasSelection: boolean) => void
}

export type TerminalInteraction = {
  dispose: () => void
  searchAddon: SearchAddon
  copySelection: () => Promise<boolean>
  cutSelection: () => Promise<void>
  paste: () => Promise<void>
  /** Injects text as if pasted, without ever touching the OS clipboard (e.g. a vault secret). */
  pasteText: (text: string) => void
  selectAll: () => void
  clearSelection: () => void
}

type PendingClick = {
  clientX: number
  clientY: number
  moved: boolean
}

function eventToBufferPos(
  term: Terminal,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const screen = getXtermScreenElement(term)
  if (!screen) return null
  const cell = clientPointToViewportCell(
    screen.getBoundingClientRect(),
    term.cols,
    term.rows,
    clientX,
    clientY
  )
  if (!cell) return null
  return viewportCellToBufferPos(term.buffer.active.viewportY, cell)
}

function attachClickToMove(term: Terminal, container: HTMLElement): () => void {
  let pending: PendingClick | null = null

  const onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.detail > 1) return
    if (!canClickToMove(term)) return
    pending = { clientX: event.clientX, clientY: event.clientY, moved: false }
  }

  const onMouseMove = (event: MouseEvent): void => {
    if (pending && !pending.moved) {
      const dx = event.clientX - pending.clientX
      const dy = event.clientY - pending.clientY
      if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        pending.moved = true
      }
    }

    if (!canClickToMove(term)) {
      container.style.cursor = ''
      return
    }
    const pos = eventToBufferPos(term, event.clientX, event.clientY)
    if (!pos) {
      container.style.cursor = ''
      return
    }
    const cursor = getCursorBufferPos(term.buffer.active)
    const bounds = getLogicalLineBounds(term.buffer.active, cursor.y)
    container.style.cursor = isInLogicalLine(bounds, pos.y) ? 'text' : ''
  }

  const finishClick = (event: MouseEvent): void => {
    const click = pending
    pending = null
    if (!click || click.moved) return
    if (event.button !== 0) return

    const pos = eventToBufferPos(term, event.clientX, event.clientY)
    if (!pos) return

    const sequence = resolveClickToMoveSequence(term, pos)
    if (!sequence) return

    term.clearSelection()
    // wasUserInput=true so focus/selection side effects stay consistent with typing.
    term.input(sequence, true)
  }

  const onMouseUp = (event: MouseEvent): void => {
    finishClick(event)
  }

  const onMouseLeave = (): void => {
    // Keep pending across leave so a mouseup outside can still finish via window.
    container.style.cursor = ''
  }

  const onWindowMouseUp = (event: MouseEvent): void => {
    if (!pending) return
    finishClick(event)
  }

  container.addEventListener('mousedown', onMouseDown)
  container.addEventListener('mousemove', onMouseMove)
  container.addEventListener('mouseup', onMouseUp)
  container.addEventListener('mouseleave', onMouseLeave)
  window.addEventListener('mouseup', onWindowMouseUp)

  return () => {
    container.removeEventListener('mousedown', onMouseDown)
    container.removeEventListener('mousemove', onMouseMove)
    container.removeEventListener('mouseup', onMouseUp)
    container.removeEventListener('mouseleave', onMouseLeave)
    window.removeEventListener('mouseup', onWindowMouseUp)
    container.style.cursor = ''
  }
}

function runCopyOrPaste(
  term: Terminal,
  copySelection: () => Promise<boolean>,
  paste: () => Promise<void>
): void {
  if (resolveMiddleButtonAction(term.hasSelection()) === 'copy') void copySelection()
  else void paste()
}

/**
 * Opens the Radix menu on the container. Button stays 0 so the capture listener
 * that treats button 2 as copy or paste does not swallow this event.
 */
function openTerminalContextMenu(container: HTMLElement, clientX: number, clientY: number): void {
  container.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0,
      view: window
    })
  )
}

function attachPointerButtons(
  term: Terminal,
  container: HTMLElement,
  getRightButtonCopies: () => boolean,
  copySelection: () => Promise<boolean>,
  paste: () => Promise<void>
): () => void {
  let pressedInside = false
  let handled = false

  const applyRightClickOption = (): void => {
    term.options.rightClickSelectsWord = terminalRightClickSelectsWord(getRightButtonCopies())
  }

  const runMiddleButton = (clientX: number, clientY: number): void => {
    const role = resolveTerminalPointerRole(1, getRightButtonCopies())
    if (role === 'menu') openTerminalContextMenu(container, clientX, clientY)
    else runCopyOrPaste(term, copySelection, paste)
  }

  const onMouseDown = (event: MouseEvent): void => {
    if (event.button === 2) {
      // xterm reads this option on the way to the target. Capture runs first.
      applyRightClickOption()
      return
    }
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    pressedInside = true
    handled = false
  }

  const onMouseUp = (event: MouseEvent): void => {
    if (event.button !== 1) return
    const target = event.target
    const inside = pressedInside && target instanceof Node && container.contains(target)
    pressedInside = false
    if (!inside) return
    event.preventDefault()
    event.stopPropagation()
    handled = true
    runMiddleButton(event.clientX, event.clientY)
  }

  const onAuxClick = (event: MouseEvent): void => {
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    // mouseup already handled the click. auxclick still has to be swallowed: on Linux,
    // xterm moves its textarea here and does not look at defaultPrevented.
    if (handled) {
      handled = false
      return
    }
    runMiddleButton(event.clientX, event.clientY)
  }

  const onContextMenu = (event: MouseEvent): void => {
    applyRightClickOption()
    if (resolveTerminalPointerRole(event.button, getRightButtonCopies()) !== 'copy-paste') return
    event.preventDefault()
    event.stopPropagation()
    runCopyOrPaste(term, copySelection, paste)
  }

  // Capture on mousedown cancels Chromium autoscroll before the target sees the button.
  container.addEventListener('mousedown', onMouseDown, true)
  window.addEventListener('mouseup', onMouseUp, true)
  container.addEventListener('auxclick', onAuxClick, true)
  container.addEventListener('contextmenu', onContextMenu, true)

  return () => {
    container.removeEventListener('mousedown', onMouseDown, true)
    window.removeEventListener('mouseup', onMouseUp, true)
    container.removeEventListener('auxclick', onAuxClick, true)
    container.removeEventListener('contextmenu', onContextMenu, true)
  }
}

export function attachTerminalInteraction(
  options: AttachTerminalInteractionOptions
): TerminalInteraction {
  const {
    term,
    container,
    getCopyOnSelect,
    getRightButtonCopies,
    isFindOpen,
    onOpenFind,
    onCloseFind,
    onLinkChange,
    onSelectionChange
  } = options

  const searchAddon = new SearchAddon()
  term.loadAddon(searchAddon)
  term.loadAddon(new ClipboardAddon(undefined, new BrowserClipboardProvider()))

  const detachPaste = attachNativePasteHandler(term, container)
  const detachCopyOnSelect = attachCopyOnSelect(term, getCopyOnSelect, onSelectionChange)
  const detachLinks = attachWebLinks(term, (url) => onLinkChange?.(url))
  const detachClickToMove = attachClickToMove(term, container)

  const copySelection = (): Promise<boolean> =>
    copyTerminalSelection(term, { clear: true, notifyError: true })

  const paste = (): Promise<void> => pasteClipboardIntoTerminal(term)
  const detachPointerButtons = attachPointerButtons(
    term,
    container,
    getRightButtonCopies,
    copySelection,
    paste
  )

  const pasteText = (text: string): void => term.paste(text)

  const selectAll = (): void => {
    selectLogicalLineOrAll(term)
    onSelectionChange?.(term.hasSelection())
  }

  const clearSelection = (): void => {
    term.clearSelection()
    onSelectionChange?.(false)
  }

  const deleteSelection = (): void => {
    const sequence = buildDeleteSelectionSequence(term)
    term.clearSelection()
    onSelectionChange?.(false)
    if (sequence) term.input(sequence, true)
  }

  const cutSelection = async (): Promise<void> => {
    // Capture delete CSI while the selection still exists, then copy without clearing.
    const sequence = buildDeleteSelectionSequence(term)
    const ok = await copyTerminalSelection(term, { clear: false, notifyError: true })
    if (!ok) return
    term.clearSelection()
    onSelectionChange?.(false)
    if (sequence) term.input(sequence, true)
  }

  const onCustomKey = (event: KeyboardEvent): boolean => {
    const action = resolveTerminalKeyAction(event, {
      // Only pay for getSelection on Escape / delete; other keys just need the cheap flag.
      hasSelection:
        event.key === 'Escape' || event.key === 'Backspace' || event.key === 'Delete'
          ? term.hasSelection() && term.getSelection().length > 0
          : term.hasSelection(),
      findOpen: isFindOpen()
    })

    if (!shouldConsumeTerminalKeyAction(action)) return true

    event.preventDefault()

    switch (action.type) {
      case 'copy':
        void copySelection()
        break
      case 'cut':
        void cutSelection()
        break
      case 'paste':
        void paste()
        break
      case 'selectAll':
        selectAll()
        break
      case 'deleteSelection':
        deleteSelection()
        break
      case 'openFind':
        onOpenFind()
        break
      case 'closeFind':
        onCloseFind()
        break
      case 'clearSelection':
        clearSelection()
        break
      case 'sendEscape':
        // Inject ESC directly so the remote PTY always receives it (Vim, nano Meta, …).
        term.input('\x1b')
        break
      case 'scrollPages':
        term.scrollPages(action.delta)
        break
      case 'scrollToTop':
        term.scrollToTop()
        break
      case 'scrollToBottom':
        term.scrollToBottom()
        break
      case 'block':
        break
      default:
        break
    }

    return false
  }

  term.attachCustomKeyEventHandler(onCustomKey)

  return {
    searchAddon,
    copySelection,
    cutSelection,
    paste,
    pasteText,
    selectAll,
    clearSelection,
    dispose: () => {
      term.attachCustomKeyEventHandler(() => true)
      detachPaste()
      detachCopyOnSelect()
      detachLinks()
      detachClickToMove()
      detachPointerButtons()
      searchAddon.dispose()
    }
  }
}
