import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AppLocale, CloseToTrayState } from '@shared/ipc'
import { isAppLocale } from './close-to-tray'

export const WINDOW_PREFS_FILE = 'window-prefs.json'

type WindowPrefs = { closeToTray: boolean; locale: AppLocale; vpnNotifications: boolean }

const DEFAULTS: WindowPrefs = { closeToTray: true, locale: 'pt-BR', vpnNotifications: true }

export function windowPrefsPath(userData: string): string {
  return join(userData, WINDOW_PREFS_FILE)
}

export function parseWindowPrefs(raw: unknown): WindowPrefs {
  const record = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    closeToTray: record.closeToTray === false ? false : DEFAULTS.closeToTray,
    locale: isAppLocale(record.locale) ? record.locale : DEFAULTS.locale,
    vpnNotifications: record.vpnNotifications === false ? false : DEFAULTS.vpnNotifications
  }
}

export function readWindowPrefs(userData: string): WindowPrefs {
  try {
    return parseWindowPrefs(JSON.parse(readFileSync(windowPrefsPath(userData), 'utf8')))
  } catch {
    return { ...DEFAULTS }
  }
}

function writeWindowPrefs(userData: string, next: WindowPrefs): void {
  const path = windowPrefsPath(userData)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(next)}\n`)
}

/** A saved VPN forces the preference on, so removing the last profile leaves the switch on. */
export function pinCloseToTrayOn(userData: string): void {
  const current = readWindowPrefs(userData)
  if (current.closeToTray) return
  writeWindowPrefs(userData, { ...current, closeToTray: true })
}

export function getCloseToTrayState(userData: string, hasVpnProfiles: boolean): CloseToTrayState {
  if (hasVpnProfiles) pinCloseToTrayOn(userData)
  const stored = readWindowPrefs(userData).closeToTray
  return { enabled: hasVpnProfiles ? true : stored, locked: hasVpnProfiles }
}

export function setCloseToTray(
  userData: string,
  enabled: boolean,
  hasVpnProfiles: boolean
): CloseToTrayState {
  if (hasVpnProfiles) pinCloseToTrayOn(userData)
  else {
    const current = readWindowPrefs(userData)
    writeWindowPrefs(userData, { ...current, closeToTray: enabled })
  }
  return getCloseToTrayState(userData, hasVpnProfiles)
}

export function setAppLocale(userData: string, locale: AppLocale): void {
  const current = readWindowPrefs(userData)
  if (current.locale === locale) return
  writeWindowPrefs(userData, { ...current, locale })
}

export function readAppLocale(userData: string): AppLocale {
  return readWindowPrefs(userData).locale
}

export function readVpnNotifications(userData: string): boolean {
  return readWindowPrefs(userData).vpnNotifications
}

export function setVpnNotifications(userData: string, enabled: boolean): boolean {
  const current = readWindowPrefs(userData)
  if (current.vpnNotifications !== enabled) {
    writeWindowPrefs(userData, { ...current, vpnNotifications: enabled })
  }
  return enabled
}
