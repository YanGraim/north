import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import { describe, expect, it } from 'vitest'

/** Preload + main runtime must expose every vpn channel (the Cypress harness mocks window.north). */
describe('vpn IPC surface', () => {
  const root = resolve(__dirname, '../../..')
  const preloadSrc = readFileSync(resolve(root, 'src/preload/index.ts'), 'utf8')
  const runtimeSrc = readFileSync(resolve(root, 'src/main/services/vpn/vpn-runtime.ts'), 'utf8')
  const handlersSrc = readFileSync(resolve(root, 'src/main/ipc/handlers.ts'), 'utf8')

  const required = [
    ['VPN_LIST', 'list'],
    ['VPN_GET', 'get'],
    ['VPN_CREATE', 'create'],
    ['VPN_UPDATE', 'update'],
    ['VPN_DELETE', 'delete'],
    ['VPN_IMPORT_OVPN', 'importOvpn'],
    ['VPN_SET_SECRET', 'setSecret'],
    ['VPN_SECRET_STATUS', 'secretStatus'],
    ['VPN_CONNECT', 'connect'],
    ['VPN_DISCONNECT', 'disconnect'],
    ['VPN_STATUS', 'status'],
    ['VPN_LOGS', 'logs'],
    ['VPN_HISTORY', 'history'],
    ['VPN_CHECK_CONFLICTS', 'checkConflicts'],
    ['VPN_PLATFORM_SUPPORT', 'platformSupport'],
    ['VPN_HELPER_STATUS', 'helperStatus'],
    ['VPN_HELPER_INSTALL', 'installHelper'],
    ['VPN_HELPER_UNINSTALL', 'uninstallHelper']
  ] as const

  it('preload invokes and main handles every vpn channel', () => {
    const vpnBlock = preloadSrc.slice(preloadSrc.indexOf('  vpn: {'))
    for (const [key, method] of required) {
      expect(IpcChannels[key]).toMatch(/^vpn:/)
      expect(vpnBlock, `preload missing ${method}`).toMatch(
        new RegExp(
          `${method}:\\s*\\([^)]*\\)\\s*=>\\s*ipcRenderer\\.invoke\\(IpcChannels\\.${key}\\b`
        )
      )
      expect(runtimeSrc, `handler missing ${key}`).toContain(`[IpcChannels.${key}]`)
    }
  })

  it('state events are subscribed in preload and handlers are registered', () => {
    expect(preloadSrc).toContain('IpcChannels.VPN_STATE_CHANGED')
    expect(handlersSrc).toContain('registerVpnHandlers(')
  })
})
