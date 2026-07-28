import { writeClipboardText } from '@renderer/lib/terminal/clipboard'
import type { Terminal } from '@xterm/xterm'

export function attachCopyOnSelect(
  term: Terminal,
  getEnabled: () => boolean,
  onSelectionChange?: (hasSelection: boolean) => void
): () => void {
  const disposable = term.onSelectionChange(() => {
    const hasSelection = term.hasSelection()
    onSelectionChange?.(hasSelection)

    if (!hasSelection || !getEnabled()) return
    const text = term.getSelection()
    if (!text) return
    void writeClipboardText(text)
  })

  return () => disposable.dispose()
}
