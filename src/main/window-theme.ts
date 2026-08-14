import { nativeChromeFor, type ThemePreference } from '@shared/lib/theme'
import { BrowserWindow, nativeTheme } from 'electron'

let currentPreference: ThemePreference = 'dark'
let listening = false

function paintWindows(preference: ThemePreference): void {
  const chrome = nativeChromeFor(preference, nativeTheme.shouldUseDarkColors)
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.setBackgroundColor(chrome.background)
    if (process.platform !== 'darwin') {
      win.setTitleBarOverlay({
        color: chrome.overlayColor,
        symbolColor: chrome.overlaySymbol,
        height: chrome.overlayHeight
      })
    }
  }
}

/**
 * Keeps AppKit traffic lights / Windows overlay in sync with the renderer theme.
 * Unfocused macOS buttons pick their gray from the native appearance — if the
 * window stays "dark" while CSS is light, they vanish on the titlebar.
 */
export function applyAppTheme(preference: ThemePreference): void {
  currentPreference = preference
  nativeTheme.themeSource = preference
  paintWindows(preference)

  if (listening) return
  listening = true
  nativeTheme.on('updated', () => {
    if (currentPreference === 'system') {
      paintWindows('system')
    }
  })
}
