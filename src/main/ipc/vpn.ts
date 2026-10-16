import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import * as sudo from '@vscode/sudo-prompt'
import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import type { Repositories } from '../repositories'
import { cleanupOpenvpnOrphans } from '../services/vpn/drivers/openvpn-driver'
import {
  DirectBroker,
  findOpenvpnBinary,
  type PrivilegeBroker,
  SudoPromptBroker
} from '../services/vpn/privilege-broker'
import { TunnelRegistry } from '../services/vpn/tunnel-registry'
import { createVpnHandlers, createVpnRuntime, type VpnRuntime } from '../services/vpn/vpn-runtime'
import type { CredentialVault } from '../vault'

let runtime: VpnRuntime | null = null

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerVpnHandlers(repos: Repositories, vault: CredentialVault): void {
  const vpnDir = join(app.getPath('userData'), 'vpn')
  const tmpDir = join(vpnDir, 'tmp')
  const tunnels = new TunnelRegistry(join(vpnDir, 'tunnels'))
  const broker: PrivilegeBroker =
    process.platform === 'win32' ? new DirectBroker() : new SudoPromptBroker(sudo.exec)

  runtime = createVpnRuntime({
    repos,
    vault,
    platform: process.platform,
    emit: (state) => broadcast(IpcChannels.VPN_STATE_CHANGED, state),
    fake: process.env.NORTH_VPN_FAKE === '1',
    openvpn: {
      binary: () => findOpenvpnBinary(process.platform, existsSync),
      broker,
      tmpDir,
      tunnels
    }
  })

  // Leftovers from a crash: stop root-owned tunnels via management, wipe temp configs.
  void cleanupOpenvpnOrphans({ tunnels, broker, tmpDir }).catch((error) =>
    console.error('[vpn] orphan cleanup failed', error)
  )

  const handlers = createVpnHandlers(runtime, process.platform)
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (_event, ...args: unknown[]) =>
      (handler as (...a: unknown[]) => unknown)(...args)
    )
  }

  const manager = runtime.manager
  powerMonitor.on('suspend', () => manager.suspend())
  powerMonitor.on('resume', () => void manager.resume())
}

export function hasActiveVpnTunnels(): boolean {
  return (
    runtime?.manager
      .listStates()
      .some((s) => s.status !== 'disconnected' && s.status !== 'error') ?? false
  )
}

export async function disposeVpn(): Promise<void> {
  await runtime?.manager.shutdown()
}
