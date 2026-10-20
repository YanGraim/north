import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { networkInterfaces, userInfo } from 'node:os'
import { basename, join } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import { formatVpnErrorMessage } from '@shared/lib/vpn/errors'
import * as sudo from '@vscode/sudo-prompt'
import { app, BrowserWindow, dialog, ipcMain, powerMonitor } from 'electron'
import helperSource from '../../../resources/vpn/north-vpn-helper?asset&asarUnpack'
import type { Repositories } from '../repositories'
import type { ConnectionMonitorService } from '../services/connection-monitor-service'
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
import { VpnError } from '../services/vpn/vpn-error'
import { VpnGate } from '../services/vpn/vpn-gate'
import { VpnHelper } from '../services/vpn/vpn-helper'
import { createVpnHandlers, createVpnRuntime, type VpnRuntime } from '../services/vpn/vpn-runtime'
import { OpenvpnServiceBroker } from '../services/vpn/windows-openvpn-service'
import { WindowsVpnComponent } from '../services/vpn/windows-vpn-component'
import { WindowsVpnService } from '../services/vpn/windows-vpn-service'
import { WindowsVpnSetup } from '../services/vpn/windows-vpn-setup'
import { WslIpsec } from '../services/vpn/wsl-ipsec'
import type { TrayVpn } from '../tray-menu'
import type { CredentialVault } from '../vault'
import { getProtocolManager } from './sessions'

let runtime: VpnRuntime | null = null
/** the tray menu (src/main/tray.ts) redraws on every VPN state or profile change */
const changeListeners = new Set<() => void>()
const notifyChange = () => {
  for (const listener of changeListeners) listener()
}

/** pinned in scripts/vpn-binaries/fetch-windows.sh; x64 is the only Windows build North ships */
const WINDOWS_OPENVPN_MSI = 'OpenVPN-2.6.14-I001-amd64.msi'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerVpnHandlers(
  repos: Repositories,
  vault: CredentialVault,
  monitor?: ConnectionMonitorService
): void {
  const vpnDir = join(app.getPath('userData'), 'vpn')
  const tmpDir = join(vpnDir, 'tmp')
  const tunnels = new TunnelRegistry(join(vpnDir, 'tunnels'))
  const broker: PrivilegeBroker =
    process.platform === 'win32' ? new DirectBroker() : new SudoPromptBroker(sudo.exec)

  // engines built by scripts/vpn-binaries/build.sh (extraResources "vpn-bin" when packaged)
  const bundledDir = app.isPackaged
    ? join(process.resourcesPath, 'vpn-bin')
    : join(app.getAppPath(), 'resources/vpn/bin')
  const findForti = () => findOpenfortivpnBinary(process.platform, existsSync, bundledDir)
  const findCharon = () => findCharonCmdBinary(process.platform, existsSync, bundledDir)
  const findOpenvpn = () => findOpenvpnBinary(process.platform, existsSync, bundledDir)
  // status runs often; hash a binary again only when it changed on disk
  const digests = new Map<string, { key: string; hash: string }>()
  const digest = (path: string): string | null => {
    try {
      const s = statSync(path)
      const key = `${s.size}:${s.mtimeMs}`
      const cached = digests.get(path)
      if (cached?.key === key) return cached.hash
      const hash = createHash('sha256').update(readFileSync(path)).digest('hex')
      digests.set(path, { key, hash })
      return hash
    } catch {
      return null
    }
  }
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
            },
            digest
          },
          broker,
          fortiBinary: findForti,
          charonBinary: findCharon,
          openvpnBinary: findOpenvpn,
          stage: (source) => {
            // own dir: the boot-time tmp cleanup must not wipe it mid-install
            const stageDir = join(vpnDir, 'helper-stage')
            mkdirSync(stageDir, { recursive: true, mode: 0o700 })
            const staged = join(stageDir, basename(source))
            copyFileSync(source, staged)
            chmodSync(staged, 0o755)
            return staged
          }
        })
      : undefined

  // Windows: the official OpenVPN package + north-vpn-service play the helper's role,
  // installed together with one UAC prompt
  const elevate = (command: string) =>
    new Promise<void>((resolve, reject) => {
      sudo.exec(command, { name: 'North' }, (error) => (error ? reject(error) : resolve()))
    })
  const windowsService =
    process.platform === 'win32'
      ? new WindowsVpnService({
          bundled: () => {
            const exe = join(bundledDir, 'north-vpn-service.exe')
            return existsSync(exe) ? exe : null
          },
          programFiles: process.env.ProgramFiles ?? 'C:\\Program Files',
          userSid: currentUserSid,
          digest,
          elevate
        })
      : undefined
  const windowsOpenvpn =
    process.platform === 'win32'
      ? new WindowsVpnComponent({
          msi: () => {
            const msi = join(bundledDir, WINDOWS_OPENVPN_MSI)
            return existsSync(msi) ? msi : null
          },
          user: userInfo().username,
          exists: existsSync,
          elevate,
          marker: {
            has: () => existsSync(join(vpnDir, 'openvpn-installed-by-north')),
            set: () => writeFileSync(join(vpnDir, 'openvpn-installed-by-north'), ''),
            clear: () => rmSync(join(vpnDir, 'openvpn-installed-by-north'), { force: true })
          }
        })
      : undefined
  const windows =
    windowsOpenvpn && windowsService
      ? new WindowsVpnSetup(windowsOpenvpn, windowsService, elevate)
      : undefined
  const component = helper ?? windows

  // Windows IPsec: North's WSL distro runs strongSwan; north-vpn-service routes to it
  function windowsIpsec(setup: WindowsVpnSetup, service: WindowsVpnService) {
    const tarball = () => {
      const tar = join(bundledDir, 'north-wsl.tar.gz')
      return existsSync(tar) ? tar : null
    }
    const importedFile = join(vpnDir, 'wsl-imported')
    const wsl = new WslIpsec({
      tarball,
      digest,
      installDir: join(vpnDir, 'wsl'),
      mkdir: (dir) => mkdirSync(dir, { recursive: true }),
      imported: {
        read: () => {
          try {
            return readFileSync(importedFile, 'utf8').trim()
          } catch {
            return null
          }
        },
        write: (value) => writeFileSync(importedFile, value)
      },
      wsl: (args) =>
        new Promise((resolve) => {
          // WSL_UTF8: wsl.exe's own messages are UTF-16 otherwise
          execFile(
            'wsl.exe',
            args,
            { timeout: 120_000, windowsHide: true, env: { ...process.env, WSL_UTF8: '1' } },
            (error, stdout, stderr) => {
              const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
              resolve({ code, stdout: `${stdout}${stderr}` })
            }
          )
        }),
      hostIps: () =>
        Object.values(networkInterfaces())
          .flat()
          .filter((a) => a?.family === 'IPv4')
          .map((a) => a?.address ?? '')
    })
    return {
      binary: tarball,
      helper: {
        ensure: async () => {
          await setup.ensure() // the service holds the Windows routes
          await wsl.ensure()
        },
        startIpsec: (input: string, onOutput: (chunk: Buffer) => void) =>
          wsl.startIpsec(input, onOutput)
      },
      tunnel: {
        up: async (
          info: { routes: string[]; redirectGateway: boolean },
          log: (line: string) => void
        ) => {
          if (info.redirectGateway || info.routes.length === 0) {
            throw new VpnError(
              'UNSUPPORTED_ON_PLATFORM',
              'Esta VPN manda todo o tráfego pelo túnel; no Windows o North só a liga em túnel dividido (redes específicas). Use o FortiClient para ela.'
            )
          }
          const gateway = await wsl.gatewayIp()
          const run = await service.holdRoutes(gateway, info.routes, log)
          log(`[north] Windows: ${info.routes.length} rede(s) da VPN via WSL (${gateway})`)
          return () => run.stop()
        }
      }
    }
  }

  runtime = createVpnRuntime({
    repos,
    vault,
    platform: process.platform,
    emit: (state) => {
      broadcast(IpcChannels.VPN_STATE_CHANGED, state)
      notifyChange()
    },
    fake: process.env.NORTH_VPN_FAKE === '1',
    openvpn: {
      binary: findOpenvpn,
      broker: windows ? new OpenvpnServiceBroker(tmpDir) : broker,
      tmpDir,
      tunnels,
      helper,
      prepare: windows ? () => windows.ensure() : undefined
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
    strongswan: helper
      ? { binary: findCharon, helper }
      : windows && windowsService
        ? windowsIpsec(windows, windowsService)
        : undefined,
    openconnect:
      windows && windowsService
        ? {
            service: {
              ensure: () => windows.ensure(),
              startForti: (r, o) => windowsService.startForti(r, o)
            },
            routes: async (localIp) => {
              await new Promise((r) => setTimeout(r, 1000))
              return listTunnelRoutes(localIp)
            }
          }
        : undefined,
    // registered everywhere so other OSes get the "Windows only" reason instead of a generic one
    windowsNative: {
      run: (cmd, args, stdin) =>
        new Promise((resolve) => {
          const root = process.env.SystemRoot ?? 'C:\\Windows'
          const bin =
            cmd === 'powershell'
              ? join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
              : join(root, 'System32', 'rasdial.exe')
          const child = execFile(
            bin,
            args,
            { timeout: 120_000, windowsHide: true },
            (error, stdout, stderr) => {
              const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
              resolve({ code, stdout: String(stdout), stderr: String(stderr) })
            }
          )
          child.stdin?.end(stdin ?? '')
        }),
      routes: async (localIp) => {
        await new Promise((r) => setTimeout(r, 1000))
        return listTunnelRoutes(localIp)
      }
    },
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

  const handlers = createVpnHandlers(runtime, process.platform, component)
  const profileChanges = new Set<string>([
    IpcChannels.VPN_CREATE,
    IpcChannels.VPN_UPDATE,
    IpcChannels.VPN_DELETE,
    IpcChannels.VPN_IMPORT_OVPN
  ])
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      const result = await (handler as (...a: unknown[]) => unknown)(...args)
      if (profileChanges.has(channel)) notifyChange()
      return result
    })
  }

  if (component) void offerHelperInstall(component, repos, join(vpnDir, 'helper-declined'))

  const manager = runtime.manager
  // sessions opened from now on bring their VPN up first
  const gate = new VpnGate({ repos, manager })
  getProtocolManager().setVpnGate(gate)
  // a server behind a VPN that is off isn't "down" — don't alert or poll it
  monitor?.setVpnReady((connectionId) => {
    const profileId = gate.profileForConnection(connectionId)
    return !profileId || manager.getState(profileId).status === 'connected'
  })
  powerMonitor.on('suspend', () => manager.suspend())
  powerMonitor.on('resume', () => void manager.resume())
}

/** "S-1-5-21-…" of the user running North (the north-vpn-service pipe only admits it). */
function currentUserSid(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('whoami', ['/user', '/fo', 'csv', '/nh'], { timeout: 10_000 }, (error, stdout) => {
      const sid = /"(S-1-(?:5-21|12-1)(?:-\d+)+)"/.exec(String(stdout))?.[1]
      if (error || !sid) reject(new Error('Não foi possível identificar o usuário do Windows'))
      else resolve(sid)
    })
  })
}

/** VPN profiles with their live status, for the tray menu. */
export function listVpnsForTray(): TrayVpn[] {
  if (!runtime) return []
  const { profiles, manager } = runtime
  return profiles
    .list()
    .map((p) => ({ id: p.id, name: p.name, status: manager.getState(p.id).status }))
}

export function onVpnChange(listener: () => void): () => void {
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}

/** Connect from the tray; the error message (already user-facing) when it fails. */
export async function connectVpnFromTray(profileId: string): Promise<string | null> {
  if (!runtime) return 'VPN indisponível'
  try {
    await runtime.manager.connect(profileId)
    return null
  } catch (error) {
    if (error instanceof VpnError) return formatVpnErrorMessage(error.code, error.message)
    return error instanceof Error ? error.message : String(error)
  }
}

export async function disconnectVpnFromTray(profileId: string): Promise<void> {
  await runtime?.manager.disconnect(profileId)
}

export function hasVpnProfiles(): boolean {
  return (runtime?.profiles.list().length ?? 0) > 0
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
  helper: Pick<VpnHelper, 'status' | 'ensure'>,
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
