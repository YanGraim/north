import { resolveTheme, useUiStore } from '@renderer/stores/ui-store'
import { msUntilAutomaticBoundary } from '@shared/lib/theme'
import { useEffect } from 'react'

/** Applies `dark` | `light` on <html> and keeps native window chrome in sync. */
export function useThemeEffect(): void {
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    let boundaryTimer: ReturnType<typeof setTimeout> | undefined

    const apply = (): void => {
      const resolved = resolveTheme(theme)
      const root = document.documentElement
      root.classList.remove('dark', 'light')
      root.classList.add(resolved)
      void window.north?.setTheme(theme)
    }

    const armAutomaticBoundary = (): void => {
      if (boundaryTimer !== undefined) clearTimeout(boundaryTimer)
      if (theme !== 'automatic') return
      boundaryTimer = setTimeout(() => {
        apply()
        useUiStore.getState().bumpAutomaticTheme()
        armAutomaticBoundary()
      }, msUntilAutomaticBoundary())
    }

    const onVisibility = (): void => {
      if (theme !== 'automatic' || document.visibilityState !== 'visible') return
      apply()
      useUiStore.getState().bumpAutomaticTheme()
      armAutomaticBoundary()
    }

    apply()
    armAutomaticBoundary()

    let media: MediaQueryList | undefined
    const onSystemChange = (): void => apply()
    if (theme === 'system') {
      media = window.matchMedia('(prefers-color-scheme: light)')
      media.addEventListener('change', onSystemChange)
    }
    if (theme === 'automatic') {
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      if (boundaryTimer !== undefined) clearTimeout(boundaryTimer)
      media?.removeEventListener('change', onSystemChange)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [theme])
}
