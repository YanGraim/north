import { describe, expect, it } from 'vitest'
import { vpnNoticeCopy, vpnNoticeFor } from './vpn-notices'

const base = {
  enabled: true,
  quitting: false
}

describe('vpnNoticeFor', () => {
  it('notifies connect, a requested disconnect, and a drop', () => {
    expect(
      vpnNoticeFor({ ...base, from: 'connecting', to: 'connected', reason: 'connected' })
    ).toBe('connected')
    expect(
      vpnNoticeFor({
        ...base,
        from: 'connected',
        to: 'disconnected',
        reason: 'disconnect-requested'
      })
    ).toBe('disconnected')
    expect(
      vpnNoticeFor({ ...base, from: 'connected', to: 'reconnecting', reason: 'dropped' })
    ).toBe('dropped')
    expect(
      vpnNoticeFor({ ...base, from: 'connected', to: 'disconnected', reason: 'dropped' })
    ).toBe('dropped')
  })

  it('stays quiet when the preference is off or the app is quitting', () => {
    expect(
      vpnNoticeFor({
        from: 'connecting',
        to: 'connected',
        reason: 'connected',
        enabled: false,
        quitting: false
      })
    ).toBeNull()
    expect(
      vpnNoticeFor({
        from: 'connected',
        to: 'disconnected',
        reason: 'disconnect-requested',
        enabled: true,
        quitting: true
      })
    ).toBeNull()
  })

  it('does not repeat a drop or announce a first failure', () => {
    expect(
      vpnNoticeFor({ ...base, from: 'reconnecting', to: 'reconnecting', reason: 'dropped' })
    ).toBeNull()
    expect(
      vpnNoticeFor({ ...base, from: 'reconnecting', to: 'error', reason: 'dropped' })
    ).toBeNull()
    expect(
      vpnNoticeFor({ ...base, from: 'connecting', to: 'error', reason: 'connected' })
    ).toBeNull()
  })
})

describe('vpnNoticeCopy', () => {
  it('uses the profile name in the active language', () => {
    expect(vpnNoticeCopy('connected', 'Escritório', 'pt-BR')).toEqual({
      title: 'VPN conectada',
      body: 'Escritório está no ar.'
    })
    expect(vpnNoticeCopy('disconnected', 'Office', 'en')).toEqual({
      title: 'VPN disconnected',
      body: 'Office was turned off.'
    })
    expect(vpnNoticeCopy('dropped', 'Oficina', 'es')).toEqual({
      title: 'VPN caída',
      body: 'Oficina perdió la conexión.'
    })
  })
})
