import { describe, expect, it } from 'vitest'
import { classifyComponentFailure, formatVpnErrorMessage, parseVpnErrorMessage } from './errors'

describe('vpn error transport', () => {
  it('round-trips code and message through Electron’s invoke wrapper', () => {
    const wire = formatVpnErrorMessage('AUTH_FAILED', 'Senha recusada pelo servidor VPN')
    const seen = `Error invoking remote method 'vpn:connect': Error: ${wire}`
    expect(parseVpnErrorMessage(seen)).toEqual({
      code: 'AUTH_FAILED',
      message: 'Senha recusada pelo servidor VPN'
    })
  })

  it('unknown shapes → null', () => {
    expect(parseVpnErrorMessage('boom')).toBeNull()
    expect(parseVpnErrorMessage('[NOT_A_CODE] x')).toBeNull()
  })
})

describe('classifyComponentFailure', () => {
  it('maps a cancelled admin prompt to PRIVILEGE_DENIED', () => {
    expect(classifyComponentFailure(new Error('User did not grant permission.'))).toBe(
      'PRIVILEGE_DENIED'
    )
    expect(classifyComponentFailure(new Error('Request dismissed'))).toBe('PRIVILEGE_DENIED')
    expect(classifyComponentFailure(new Error('The operation was canceled by the user.'))).toBe(
      'PRIVILEGE_DENIED'
    )
  })

  it('keeps a VpnError that is already one of the three component codes', () => {
    expect(classifyComponentFailure({ code: 'BINARY_MISSING', message: 'north-wsl.tar.gz' })).toBe(
      'BINARY_MISSING'
    )
    expect(classifyComponentFailure({ code: 'DRIVER_CRASHED', message: 'Command failed' })).toBe(
      'DRIVER_CRASHED'
    )
    expect(classifyComponentFailure({ code: 'PRIVILEGE_DENIED', message: 'x' })).toBe(
      'PRIVILEGE_DENIED'
    )
  })

  it('does not read Access is denied or a generic Command failed as a cancelled prompt', () => {
    const raw =
      'Command failed: Access is denied C:\\Program Files\\North VPN Service\\north-vpn-service.exe'
    expect(classifyComponentFailure(new Error(raw))).toBe('DRIVER_CRASHED')
  })

  it('does not invent BINARY_MISSING from a path in the message', () => {
    expect(classifyComponentFailure(new Error('ENOENT north-wsl.tar.gz'))).toBe('DRIVER_CRASHED')
  })

  it('collapses any other VpnError code, even when the message says cancel', () => {
    expect(classifyComponentFailure({ code: 'AUTH_FAILED', message: 'cancel' })).toBe(
      'DRIVER_CRASHED'
    )
  })
})
