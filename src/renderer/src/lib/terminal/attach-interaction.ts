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
import { attachCopyOnSelect } from '@renderer/lib/terminal/selection'
import { BrowserClipboardProvider, ClipboardAddon } from '@xterm/addon-clipboard'
import { SearchAddon } from '@xterm/addon-search'
import type { Terminal } from '@xterm/xterm'

export type AttachTerminalInteractionOptions = {
  term: Terminal
  container: HTMLElement
  getCopyOnSelect: () => boolean
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
  paste: () => Promise<void>
  selectAll: () => void
  clearSelection: () => void
}

export function attachTerminalInteraction(
  options: AttachTerminalInteractionOptions
): TerminalInteraction {
  const {
    term,
    container,
    getCopyOnSelect,
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

  const copySelection = (): Promise<boolean> =>
    copyTerminalSelection(term, { clear: true, notifyError: true })

  const paste = (): Promise<void> => pasteClipboardIntoTerminal(term)

  const selectAll = (): void => {
    term.selectAll()
  }

  const clearSelection = (): void => {
    term.clearSelection()
    onSelectionChange?.(false)
  }

  const onCustomKey = (event: KeyboardEvent): boolean => {
    const action = resolveTerminalKeyAction(event, {
      // Only pay for getSelection on Escape; other keys just need the cheap flag.
      hasSelection:
        event.key === 'Escape'
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
      case 'paste':
        void paste()
        break
      case 'selectAll':
        selectAll()
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
    paste,
    selectAll,
    clearSelection,
    dispose: () => {
      term.attachCustomKeyEventHandler(() => true)
      detachPaste()
      detachCopyOnSelect()
      detachLinks()
      searchAddon.dispose()
    }
  }
}
