import { WebLinksAddon } from '@xterm/addon-web-links'
import type { Terminal } from '@xterm/xterm'

export function openTerminalLink(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function attachWebLinks(
  term: Terminal,
  onHoverLink: (url: string | null) => void
): () => void {
  const addon = new WebLinksAddon(
    (_event, uri) => {
      openTerminalLink(uri)
    },
    {
      hover: (_event, text) => {
        onHoverLink(text)
      },
      leave: () => {
        onHoverLink(null)
      }
    }
  )
  term.loadAddon(addon)
  return () => addon.dispose()
}
