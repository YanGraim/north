import type { AppLocale } from '@shared/ipc'

const LOCALES: readonly AppLocale[] = ['pt-BR', 'en', 'es']

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Quit always closes. A saved VPN always hides. Otherwise the preference decides.
 * macOS still does not call `app.quit` when this returns false: the window just closes.
 */
export function shouldHideOnClose(input: {
  quitting: boolean
  hasVpnProfiles: boolean
  closeToTray: boolean
}): boolean {
  if (input.quitting) return false
  return input.hasVpnProfiles || input.closeToTray
}

const TRAY_HINT: Record<AppLocale, { title: string; darwin: string; other: string }> = {
  'pt-BR': {
    title: 'O North continua aberto',
    darwin: 'O North fica no ícone da barra de menus.',
    other: 'O North fica no ícone da bandeja, perto do relógio.'
  },
  en: {
    title: 'North is still open',
    darwin: 'North stays in the menu bar icon.',
    other: 'North stays in the tray icon, next to the clock.'
  },
  es: {
    title: 'North sigue abierto',
    darwin: 'North queda en el icono de la barra de menús.',
    other: 'North queda en el icono de la bandeja, junto al reloj.'
  }
}

export function trayHintCopy(
  locale: AppLocale,
  platform: NodeJS.Platform
): { title: string; body: string } {
  const copy = TRAY_HINT[locale]
  return { title: copy.title, body: platform === 'darwin' ? copy.darwin : copy.other }
}
