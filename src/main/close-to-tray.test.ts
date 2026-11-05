import { describe, expect, it } from 'vitest'
import { isAppLocale, shouldHideOnClose, trayHintCopy } from './close-to-tray'

describe('shouldHideOnClose', () => {
  it('hides when the preference is on and there is no VPN', () => {
    expect(shouldHideOnClose({ quitting: false, hasVpnProfiles: false, closeToTray: true })).toBe(
      true
    )
  })

  it('closes when the preference is off and there is no VPN', () => {
    expect(shouldHideOnClose({ quitting: false, hasVpnProfiles: false, closeToTray: false })).toBe(
      false
    )
  })

  it('hides while a VPN profile exists, even if the preference is off', () => {
    expect(shouldHideOnClose({ quitting: false, hasVpnProfiles: true, closeToTray: false })).toBe(
      true
    )
  })

  it('closes on a real quit even with a VPN and the preference on', () => {
    expect(shouldHideOnClose({ quitting: true, hasVpnProfiles: true, closeToTray: true })).toBe(
      false
    )
  })
})

describe('trayHintCopy', () => {
  it('uses the active locale and does not mention VPN', () => {
    const en = trayHintCopy('en', 'win32')
    expect(en).toEqual({
      title: 'North is still open',
      body: 'North stays in the tray icon, next to the clock.'
    })
    expect(en.body).not.toMatch(/vpn/i)
    expect(trayHintCopy('es', 'darwin').body).toBe('North queda en el icono de la barra de menús.')
    expect(trayHintCopy('pt-BR', 'linux').body).toBe(
      'O North fica no ícone da bandeja, perto do relógio.'
    )
  })
})

describe('isAppLocale', () => {
  it('accepts the three locales', () => {
    expect(isAppLocale('pt-BR')).toBe(true)
    expect(isAppLocale('en')).toBe(true)
    expect(isAppLocale('fr')).toBe(false)
  })
})
