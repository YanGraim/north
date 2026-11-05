import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getCloseToTrayState,
  parseWindowPrefs,
  pinCloseToTrayOn,
  readVpnNotifications,
  readWindowPrefs,
  setCloseToTray,
  setVpnNotifications,
  windowPrefsPath
} from './window-prefs'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'north-window-prefs-'))
  dirs.push(dir)
  return dir
}

describe('parseWindowPrefs', () => {
  it('defaults to close-to-tray on, Portuguese, and VPN notices on', () => {
    expect(parseWindowPrefs(undefined)).toEqual({
      closeToTray: true,
      locale: 'pt-BR',
      vpnNotifications: true
    })
    expect(parseWindowPrefs({ closeToTray: false, locale: 'en' })).toEqual({
      closeToTray: false,
      locale: 'en',
      vpnNotifications: true
    })
    expect(parseWindowPrefs({ locale: 'nope' }).locale).toBe('pt-BR')
    expect(parseWindowPrefs({ vpnNotifications: false }).vpnNotifications).toBe(false)
  })
})

describe('close to tray persistence', () => {
  it('stays on when the file is missing', () => {
    const dir = tempDir()
    expect(getCloseToTrayState(dir, false)).toEqual({ enabled: true, locked: false })
  })

  it('stores off only when no VPN profile exists', () => {
    const dir = tempDir()
    expect(setCloseToTray(dir, false, false)).toEqual({ enabled: false, locked: false })
    expect(readWindowPrefs(dir).closeToTray).toBe(false)
  })

  it('ignores off while a VPN exists and leaves the switch on after the last profile is gone', () => {
    const dir = tempDir()
    setCloseToTray(dir, false, false)
    expect(setCloseToTray(dir, false, true)).toEqual({ enabled: true, locked: true })
    expect(JSON.parse(readFileSync(windowPrefsPath(dir), 'utf8')).closeToTray).toBe(true)
    expect(getCloseToTrayState(dir, false)).toEqual({ enabled: true, locked: false })
  })

  it('pins the preference on when a profile appears', () => {
    const dir = tempDir()
    setCloseToTray(dir, false, false)
    pinCloseToTrayOn(dir)
    expect(readWindowPrefs(dir).closeToTray).toBe(true)
  })

  it('falls back when the file is not JSON', () => {
    const dir = tempDir()
    writeFileSync(windowPrefsPath(dir), '{')
    expect(readWindowPrefs(dir)).toEqual({
      closeToTray: true,
      locale: 'pt-BR',
      vpnNotifications: true
    })
  })
})

describe('vpn notification preference', () => {
  it('stays on when the file is missing and stores off without touching close-to-tray', () => {
    const dir = tempDir()
    expect(readVpnNotifications(dir)).toBe(true)
    expect(setVpnNotifications(dir, false)).toBe(false)
    expect(readVpnNotifications(dir)).toBe(false)
    setCloseToTray(dir, false, false)
    expect(readWindowPrefs(dir)).toEqual({
      closeToTray: false,
      locale: 'pt-BR',
      vpnNotifications: false
    })
  })
})
