import { describe, expect, it } from 'vitest'
import { formatVpnErrorMessage, parseVpnErrorMessage } from './errors'

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
