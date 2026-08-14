import { resolveTheme, useUiStore } from '@renderer/stores/ui-store'
import type { ITheme } from '@xterm/xterm'

const DARK_THEME: ITheme = {
  background: '#0a0e17',
  foreground: '#e8edf7',
  cursor: '#3d8bfd',
  cursorAccent: '#0a0e17',
  selectionBackground: '#3d8bfd55',
  black: '#0a0e17',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3d8bfd',
  magenta: '#a855f7',
  cyan: '#14b8a6',
  white: '#e8edf7',
  brightBlack: '#8b97ad',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#2dd4bf',
  brightWhite: '#ffffff'
}

const LIGHT_THEME: ITheme = {
  background: '#f1f5f9',
  foreground: '#0f172a',
  cursor: '#1a56c4',
  cursorAccent: '#ffffff',
  selectionBackground: '#1a56c444',
  black: '#0f172a',
  red: '#b91c1c',
  green: '#15803d',
  yellow: '#a16207',
  blue: '#1a56c4',
  magenta: '#7e22ce',
  cyan: '#0f766e',
  white: '#e2e8f0',
  brightBlack: '#64748b',
  brightRed: '#dc2626',
  brightGreen: '#16a34a',
  brightYellow: '#ca8a04',
  brightBlue: '#2563eb',
  brightMagenta: '#9333ea',
  brightCyan: '#0d9488',
  brightWhite: '#ffffff'
}

export function getXtermTheme(resolved: 'dark' | 'light'): ITheme {
  return resolved === 'light' ? LIGHT_THEME : DARK_THEME
}

export function useResolvedTheme(): 'dark' | 'light' {
  const theme = useUiStore((s) => s.theme)
  return resolveTheme(theme)
}
