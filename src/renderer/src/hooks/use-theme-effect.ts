import { resolveTheme, useUiStore } from '@renderer/stores/ui-store'
import { useEffect } from 'react'

/** Applies `dark` | `light` on <html> and keeps BrowserWindow-friendly body bg in sync. */
export function useThemeEffect(): void {
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    const apply = (): void => {
      const resolved = resolveTheme(theme)
      const root = document.documentElement
      root.classList.remove('dark', 'light')
      root.classList.add(resolved)
    }

    apply()

    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = (): void => apply()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])
}
