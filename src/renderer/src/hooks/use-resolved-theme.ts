import { resolveTheme, useUiStore } from '@renderer/stores/ui-store'
import { type ResolvedTheme, resolveAutomaticTheme } from '@shared/lib/theme'

/** Light/dark actually on screen. Automatic mode re-reads the clock at each boundary. */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useUiStore((s) => s.theme)
  const automaticThemeTick = useUiStore((s) => s.automaticThemeTick)
  if (theme === 'automatic') {
    // The tick is a render signal; the color comes from the local clock.
    void automaticThemeTick
    return resolveAutomaticTheme(new Date())
  }
  return resolveTheme(theme)
}
