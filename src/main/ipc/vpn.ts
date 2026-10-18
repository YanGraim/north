import { execFile } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import * as sudo from '@vscode/sudo-prompt'
import { app, BrowserWindow, dialog, ipcMain, powerMonitor } from 'electron'
import helperSource from '../../../resources/vpn/north-vpn-helper?asset&asarUnpack'
import type { Repositories } from '../repositories'
import { cleanupFortiOrphans } from '../services/vpn/drivers/openfortivpn-driver'
import { cleanupOpenvpnOrphans } from '../services/vpn/drivers/openvpn-driver'
import {
  DirectBroker,
  findCharonCmdBinary,
  findOpenfortivpnBinary,
  findOpenvpnBinary,
  type PrivilegeBroker,
  SudoPromptBroker
} from '../services/vpn/privilege-broker'
import { TunnelRegistry } from '../services/vpn/tunnel-registry'
import { listTunnelRoutes } from '../services/vpn/tunnel-routes'
import { VpnHelper } from '../services/vpn/vpn-helper'
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

  const findForti = () => findOpenfortivpnBinary(process.platform, existsSync)
  const findCharon = () => findCharonCmdBinary(process.platform, existsSync)
  const helper =
    process.platform === 'darwin' || process.platform === 'linux'
      ? new VpnHelper({
          platform: process.platform,
          source: helperSource,
          user: userInfo().username,
          fs: {
            read: (path) => {
              try {
                return readFileSync(path, 'utf8')
              } catch {
                return null
              }
            },
            stat: (path) => {
              try {
                const s = statSync(path)
                return { uid: s.uid, mode: s.mode }
              } catch {
                return null
              }
            }
          },
          broker,
          fortiBinary: findForti,
          charonBinary: findCharon,
          openvpnBinary: () => findOpenvpnBinary(process.platform, existsSync),
          stage: (source) => {
            // own dir: the boot-time tmp cleanup must not wipe it mid-install
            const stageDir = join(vpnDir, 'helper-stage')
            mkdirSync(stageDir, { recursive: true, mode: 0o700 })
            const staged = join(stageDir, 'north-vpn-helper')
            copyFileSync(source, staged)
            return staged
          }
        })
      : undefined

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
      tunnels,
      helper
    },
    macosIpsec: {
      run: (cmd, args) =>
        new Promise((resolve) => {
          // Only fixed system binaries, never a shell; secrets never reach argv (they live in the profile).
          const bin = cmd === 'scutil' ? '/usr/sbin/scutil' : '/usr/bin/open'
          execFile(bin, args, { timeout: 15_000 }, (error, stdout, stderr) => {
            const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
            resolve({ code, stdout: String(stdout), stderr: String(stderr) })
          })
        }),
      tmpDir,
      installedFile: join(vpnDir, 'ipsec-installed.json')
    },
    strongswan: helper ? { binary: findCharon, helper } : undefined,
    openfortivpn: {
      binary: findForti,
      broker,
      tmpDir,
      helper,
      // pppd needs a moment to install the pushed routes after "Tunnel is up"
      routes: async (localIp) => {
        await new Promise((r) => setTimeout(r, 1000))
        return listTunnelRoutes(localIp)
      }
    }
  })

  // Leftovers from a crash: stop root-owned tunnels via management, wipe temp configs.
  // SSL-VPN wrappers first (they only need their stop file), then the shared tmp wipe.
  void (helper?.stopAll() ?? Promise.resolve())
    .then(() => cleanupFortiOrphans(tmpDir))
    .then(() => cleanupOpenvpnOrphans({ tunnels, broker, tmpDir }))
    .catch((error) => console.error('[vpn] orphan cleanup failed', error))

  const handlers = createVpnHandlers(runtime, process.platform, helper)
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (_event, ...args: unknown[]) =>
      (handler as (...a: unknown[]) => unknown)(...args)
    )
  }

  if (helper) void offerHelperInstall(helper, repos, join(vpnDir, 'helper-declined'))

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

/**
 * The .dmg / AppImage have no install step, so the "installer" moment is the first launch
 * that has VPNs: one admin prompt and tunnels never ask again. Declining is remembered;
 * the first connect (or the VPNs page) still offers it.
 */
async function offerHelperInstall(
  helper: VpnHelper,
  repos: Repositories,
  declinedFile: string
): Promise<void> {
  if (helper.status() === 'installed') return
  if (existsSync(declinedFile) || repos.vpnProfiles.list().length === 0) return
  await app.whenReady()
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Instalar', 'Agora não'],
    defaultId: 0,
    cancelId: 1,
    message: 'Conectar VPNs sem pedir senha?',
    detail:
      'O North vai instalar um componente de VPN (como o FortiClient faz). O sistema pede sua senha de administrador uma única vez; depois, conectar e desconectar não pedem mais. Dá para remover na página de VPNs.'
  })
  if (response !== 0) {
    writeFileSync(declinedFile, '')
    return
  }
  try {
    await helper.ensure()
  } catch (error) {
    console.error('[vpn] helper install failed', error)
  }
}
