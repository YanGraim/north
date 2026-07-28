import type { Terminal } from '@xterm/xterm'

function isPasteShortcut(event: KeyboardEvent): boolean {
  if (event.type !== 'keydown') return false
  if (event.shiftKey && event.key === 'Insert') return true
  const key = event.key.toLowerCase()
  if (key !== 'v') return false
  return event.ctrlKey || event.metaKey
}

async function pasteClipboardIntoTerminal(term: Terminal): Promise<void> {
  try {
    const text = await navigator.clipboard.readText()
    if (text) term.paste(text)
  } catch {
    // Clipboard permission denied or unavailable — ignore silently.
  }
}

export function attachTerminalPasteHandlers(term: Terminal, container: HTMLElement): () => void {
  const onCustomKey = (event: KeyboardEvent): boolean => {
    if (!isPasteShortcut(event)) return true
    event.preventDefault()
    void pasteClipboardIntoTerminal(term)
    return false
  }

  const onPaste = (event: ClipboardEvent): void => {
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain')
    if (text) term.paste(text)
  }

  term.attachCustomKeyEventHandler(onCustomKey)
  container.addEventListener('paste', onPaste)

  return () => {
    term.attachCustomKeyEventHandler(() => true)
    container.removeEventListener('paste', onPaste)
  }
}

export function terminalPasteShortcutLabel(): string {
  const isApple =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  return isApple ? '⌘V' : 'Ctrl+V'
}
