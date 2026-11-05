import { resolveAppFontStack } from '@renderer/lib/app-font'
import { resolveMonoFontStack } from '@renderer/lib/mono-font'
import { DEFAULT_MONO_FONT_SIZE, useUiStore } from '@renderer/stores/ui-store'
import { useEffect } from 'react'

const BASE_ROOT_FONT_SIZE_PX = 16

/** Publishes the interface family and the monospace family as separate CSS variables. */
export function useCodeFontEffect(): void {
  const fontSize = useUiStore((s) => s.monoFontSize)
  const appFontFamily = useUiStore((s) => s.appFontFamily)
  const monoFontFamily = useUiStore((s) => s.monoFontFamily)
  const ligatures = useUiStore((s) => s.monoLigatures)

  useEffect(() => {
    const root = document.documentElement
    const appStack = resolveAppFontStack(appFontFamily)
    const monoStack = resolveMonoFontStack(monoFontFamily, ligatures)
    root.style.setProperty('--font-sans', appStack)
    root.style.setProperty('--font-display', appStack)
    root.style.setProperty('--font-mono', monoStack)
    root.style.setProperty('--code-font-size', `${fontSize}px`)
    root.style.setProperty('--code-font-family', monoStack)
    root.style.setProperty('--code-ligatures', ligatures ? 'normal' : 'none')
    // Code ligatures stay on monospace surfaces. Clearing the root keeps Inter's own features.
    root.style.fontVariantLigatures = ''
    // Scaled relative to the default so untouched installs keep the original 16px root size;
    // every rem-based size in the app (buttons, text, spacing) scales with it.
    root.style.fontSize = `${(BASE_ROOT_FONT_SIZE_PX * fontSize) / DEFAULT_MONO_FONT_SIZE}px`
  }, [fontSize, appFontFamily, monoFontFamily, ligatures])
}
