import {
  DEFAULT_MONO_FONT_SIZE,
  MONO_FONT_FAMILY_STACKS,
  useUiStore
} from '@renderer/stores/ui-store'
import { useEffect } from 'react'

const BASE_ROOT_FONT_SIZE_PX = 16

/** Applies the user's chosen font across the whole app: UI text, terminal, code editors, hosts/ports/shortcuts. */
export function useCodeFontEffect(): void {
  const fontSize = useUiStore((s) => s.monoFontSize)
  const fontFamily = useUiStore((s) => s.monoFontFamily)

  useEffect(() => {
    const root = document.documentElement
    const stack = MONO_FONT_FAMILY_STACKS[fontFamily]
    root.style.setProperty('--font-sans', stack)
    root.style.setProperty('--font-display', stack)
    root.style.setProperty('--font-mono', stack)
    root.style.setProperty('--code-font-size', `${fontSize}px`)
    root.style.setProperty('--code-font-family', stack)
    // Scaled relative to the default so untouched installs keep the original 16px root size;
    // every rem-based size in the app (buttons, text, spacing) scales with it.
    root.style.fontSize = `${(BASE_ROOT_FONT_SIZE_PX * fontSize) / DEFAULT_MONO_FONT_SIZE}px`
  }, [fontSize, fontFamily])
}
