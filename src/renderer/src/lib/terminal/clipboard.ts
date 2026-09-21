import { isApplePlatform } from '@renderer/lib/platform'
import { toastError } from '@renderer/lib/toast'
import type { Terminal } from '@xterm/xterm'

export { isApplePlatform }

export function terminalModKeyLabel(platform?: string): string {
  return isApplePlatform(platform) ? '⌘' : 'Ctrl'
}

export function terminalPasteShortcutLabel(platform?: string): string {
  const mod = terminalModKeyLabel(platform)
  return isApplePlatform(platform) ? `${mod}V` : `${mod}+V`
}

export function terminalCopyShortcutLabel(platform?: string): string {
  const mod = terminalModKeyLabel(platform)
  return isApplePlatform(platform) ? `${mod}C` : `${mod}+C`
}

export function terminalCutShortcutLabel(platform?: string): string {
  const mod = terminalModKeyLabel(platform)
  return isApplePlatform(platform) ? `${mod}X` : `${mod}+X`
}

export function terminalSelectAllShortcutLabel(platform?: string): string {
  const mod = terminalModKeyLabel(platform)
  return isApplePlatform(platform) ? `${mod}A` : `${mod}+A`
}

export function terminalFindShortcutLabel(platform?: string): string {
  const mod = terminalModKeyLabel(platform)
  return isApplePlatform(platform) ? `${mod}F` : `${mod}+F`
}

export async function writeClipboardText(
  text: string,
  options: { notifyError?: boolean } = {}
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    if (options.notifyError) {
      toastError(error, 'Não foi possível copiar')
    }
    return false
  }
}

export async function readClipboardText(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}

/** First image item on the OS clipboard, if any — a pty can't take image bytes directly. */
export async function readClipboardImage(): Promise<{ blob: Blob; mimeType: string } | null> {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const mimeType = item.types.find((type) => type.startsWith('image/'))
      if (mimeType) return { blob: await item.getType(mimeType), mimeType }
    }
    return null
  } catch {
    return null
  }
}

/** Writes the image to a temp file (via main) and pastes its path as text, like iTerm2/Terminal.app do. */
export async function pasteImageIntoTerminal(
  term: Terminal,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const path = await window.north.terminal.pasteImage(bytes, mimeType)
  term.paste(path)
}

export async function pasteClipboardIntoTerminal(term: Terminal): Promise<void> {
  const image = await readClipboardImage()
  if (image) {
    await pasteImageIntoTerminal(term, image.blob, image.mimeType)
    return
  }
  const text = await readClipboardText()
  if (text) term.paste(text)
}

export async function copyTerminalSelection(
  term: Terminal,
  options: { clear?: boolean; notifyError?: boolean } = {}
): Promise<boolean> {
  if (!term.hasSelection()) return false
  const text = term.getSelection()
  if (!text) return false
  const ok = await writeClipboardText(text, { notifyError: options.notifyError ?? true })
  if (ok && options.clear !== false) term.clearSelection()
  return ok
}

export function attachNativePasteHandler(term: Terminal, container: HTMLElement): () => void {
  const onPaste = (event: ClipboardEvent): void => {
    event.preventDefault()
    const items = event.clipboardData?.items
    const imageItem = items
      ? Array.from(items).find((item) => item.type.startsWith('image/'))
      : undefined
    if (imageItem) {
      const file = imageItem.getAsFile()
      if (file) {
        void pasteImageIntoTerminal(term, file, imageItem.type)
        return
      }
    }
    const text = event.clipboardData?.getData('text/plain')
    if (text) term.paste(text)
  }

  container.addEventListener('paste', onPaste)
  return () => container.removeEventListener('paste', onPaste)
}
