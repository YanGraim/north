import {
  msUntilAutomaticBoundary,
  nativeChromeFor,
  resolveNativeTheme,
  type ThemePreference
} from '@shared/lib/theme'
import { BrowserWindow, nativeTheme, powerMonitor } from 'electron'

let currentPreference: ThemePreference = 'dark'
let listening = false
let boundaryTimer: ReturnType<typeof setTimeout> | null = null

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

function clearBoundaryTimer(): void {
  if (boundaryTimer === null) return
  clearTimeout(boundaryTimer)
  boundaryTimer = null
}

/** `nativeTheme.themeSource` only accepts dark, light, or system. */
function themeSourceFor(preference: ThemePreference): 'dark' | 'light' | 'system' {
  if (preference === 'automatic') {
    return resolveNativeTheme(preference, nativeTheme.shouldUseDarkColors)
  }
  return preference
}

function scheduleAutomaticRepaint(): void {
  clearBoundaryTimer()
  if (currentPreference !== 'automatic') return
  boundaryTimer = setTimeout(() => {
    boundaryTimer = null
    if (currentPreference !== 'automatic') return
    applyAppTheme('automatic')
  }, msUntilAutomaticBoundary())
}

/**
 * Keeps AppKit traffic lights / Windows overlay in sync with the renderer theme.
 * Unfocused macOS buttons pick their gray from the native appearance — if the
 * window stays "dark" while CSS is light, they vanish on the titlebar.
 */
export function applyAppTheme(preference: ThemePreference): void {
  currentPreference = preference
  nativeTheme.themeSource = themeSourceFor(preference)
  paintWindows(preference)
  scheduleAutomaticRepaint()

  if (listening) return
  listening = true
  nativeTheme.on('updated', () => {
    if (currentPreference === 'system') {
      paintWindows('system')
    }
  })
  powerMonitor.on('resume', () => {
    if (currentPreference === 'automatic') applyAppTheme('automatic')
  })
}
