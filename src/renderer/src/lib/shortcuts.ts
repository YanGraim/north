/**
 * Registro central de atalhos do North.
 * Base para atalhos configuráveis no futuro.
 */

import { isApplePlatform } from '@renderer/lib/platform'

export type ShortcutId =
  | 'commandPalette'
  | 'toggleSidebar'
  | 'newConnection'
  | 'closeTab'
  | 'duplicateTab'
  | 'formatSql'

export type ShortcutDefinition = {
  id: ShortcutId
  /** Tecla (lowercase) */
  key: string
  /** Exige Cmd (macOS) ou Ctrl (outros) */
  mod: boolean
  /** Exige Shift */
  shift?: boolean
  label: string
  description: string
}

export const SHORTCUTS: Record<ShortcutId, ShortcutDefinition> = {
  commandPalette: {
    id: 'commandPalette',
    key: 'k',
    mod: true,
    label: '⌘K',
    description: 'Abrir command palette'
  },
  toggleSidebar: {
    id: 'toggleSidebar',
    key: 'b',
    mod: true,
    label: '⌘B',
    description: 'Alternar sidebar'
  },
  newConnection: {
    id: 'newConnection',
    key: 'n',
    mod: true,
    label: '⌘N',
    description: 'Nova conexão'
  },
  closeTab: {
    id: 'closeTab',
    key: 'w',
    mod: true,
    label: '⌘W',
    description: 'Fechar aba de sessão'
  },
  duplicateTab: {
    id: 'duplicateTab',
    key: 'd',
    mod: true,
    shift: true,
    label: '⌘⇧D',
    description: 'Duplicar sessão ativa'
  },
  formatSql: {
    id: 'formatSql',
    key: 'f',
    mod: true,
    shift: true,
    label: '⌘⇧F',
    description: 'Formatar SQL'
  }
}

export function isModPressed(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

export function matchesShortcut(event: KeyboardEvent, id: ShortcutId): boolean {
  const shortcut = SHORTCUTS[id]
  if (event.key.toLowerCase() !== shortcut.key) return false
  if (shortcut.mod && !isModPressed(event)) return false
  if (!shortcut.mod && isModPressed(event)) return false
  if (Boolean(shortcut.shift) !== event.shiftKey) return false
  return true
}

/** Rótulo de tecla adaptado ao SO (⌘ no Apple, Ctrl nos demais). */
export function shortcutDisplayLabel(id: ShortcutId): string {
  const shortcut = SHORTCUTS[id]
  const isApple = isApplePlatform()
  if (!shortcut.mod) return shortcut.key.toUpperCase()
  const mod = isApple ? '⌘' : 'Ctrl+'
  const shift = shortcut.shift ? (isApple ? '⇧' : 'Shift+') : ''
  return `${mod}${shift}${shortcut.key.toUpperCase()}`
}
