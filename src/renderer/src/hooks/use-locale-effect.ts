import i18n from '@renderer/i18n'
import { useUiStore } from '@renderer/stores/ui-store'
import { useEffect } from 'react'

/** Keeps i18next language in sync with ui-store locale. */
export function useLocaleEffect(): void {
  const locale = useUiStore((s) => s.locale)

  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale)
    }
  }, [locale])
}
