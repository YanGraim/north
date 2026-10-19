import { type ChildProcess, spawn } from 'node:child_process'
import { isAbsolute, join } from 'node:path'
import { shellQuote } from '@shared/lib/shell-quote'
import { VpnError } from './vpn-error'

export type LaunchResult = { code: number | null; error?: VpnError }

export type LaunchedProcess = {
  exited: Promise<LaunchResult>
}

/** How North starts a process that needs OS privilege (TUN, routes, DNS). */
export interface PrivilegeBroker {
  launch(binary: string, args: string[]): LaunchedProcess
  /** Last-resort kill of an orphaned elevated process by pid. */
  kill(pid: number): Promise<void>
}

const OPENVPN_CANDIDATES: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: ['/opt/homebrew/sbin/openvpn', '/usr/local/sbin/openvpn', '/opt/homebrew/bin/openvpn'],
  linux: ['/usr/sbin/openvpn', '/usr/bin/openvpn', '/usr/local/sbin/openvpn'],
  win32: ['C:\\Program Files\\OpenVPN\\bin\\openvpn.exe']
}

const OPENFORTIVPN_CANDIDATES: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: ['/opt/homebrew/bin/openfortivpn', '/usr/local/bin/openfortivpn'],
  linux: ['/usr/bin/openfortivpn', '/usr/sbin/openfortivpn', '/usr/local/bin/openfortivpn']
}

const CHARON_CMD_CANDIDATES: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: [
    '/opt/homebrew/opt/strongswan/bin/charon-cmd',
    '/usr/local/opt/strongswan/bin/charon-cmd'
  ],
  linux: ['/usr/sbin/charon-cmd', '/usr/bin/charon-cmd', '/usr/local/sbin/charon-cmd']
}

/**
 * The engine North ships (resources/vpn/bin, built by scripts/vpn-binaries/build.sh)
 * comes first; a system install (Homebrew, distro package) is the fallback.
 */
function findBinary(
  name: string,
  candidates: string[] | undefined,
  exists: (path: string) => boolean,
  bundledDir?: string | null
): string | null {
  const bundled = bundledDir ? join(bundledDir, name) : null
  return [...(bundled ? [bundled] : []), ...(candidates ?? [])].find((p) => exists(p)) ?? null
}

/** strongSwan's one-shot IKE client (IPsec IKEv1 on macOS/Linux). */
export function findCharonCmdBinary(
  platform: NodeJS.Platform,
  exists: (path: string) => boolean,
  bundledDir?: string | null
): string | null {
  return findBinary('charon-cmd', CHARON_CMD_CANDIDATES[platform], exists, bundledDir)
}

/** openfortivpn has no Windows build — Windows SSL-VPN needs another engine. */
export function findOpenfortivpnBinary(
  platform: NodeJS.Platform,
  exists: (path: string) => boolean,
  bundledDir?: string | null
): string | null {
  return findBinary('openfortivpn', OPENFORTIVPN_CANDIDATES[platform], exists, bundledDir)
}

/** Windows still uses the OpenVPN installer's openvpn.exe (no bundled build there yet). */
export function findOpenvpnBinary(
  platform: NodeJS.Platform,
  exists: (path: string) => boolean,
  bundledDir?: string | null
): string | null {
  return findBinary('openvpn', OPENVPN_CANDIDATES[platform], exists, bundledDir)
}

export function buildElevatedCommand(binary: string, args: string[]): string {
  if (!isAbsolute(binary)) throw new Error('Elevated binary must be an absolute path')
  for (const arg of [binary, ...args]) {
    if (/[\r\n\0]/.test(arg)) throw new Error('Elevated arguments must not contain line breaks')
  }
  return [binary, ...args].map(shellQuote).join(' ')
}

type SudoExec = (
  cmd: string,
  options: { name: string },
  callback: (error?: Error, stdout?: string | Buffer, stderr?: string | Buffer) => void
) => void

/** mac/Linux v1: native admin prompt (osascript / pkexec) per launch. */
export class SudoPromptBroker implements PrivilegeBroker {
  constructor(private readonly exec: SudoExec) {}

  launch(binary: string, args: string[]): LaunchedProcess {
    const command = buildElevatedCommand(binary, args)
    const exited = new Promise<LaunchResult>((resolve) => {
      this.exec(command, { name: 'North' }, (error) => {
        if (!error) return resolve({ code: 0 })
        if (/did not grant permission|Request dismissed|cancel/i.test(error.message)) {
          return resolve({
            code: null,
            error: new VpnError('PRIVILEGE_DENIED', 'Permissão de administrador negada')
          })
        }
        resolve({ code: 1, error: new VpnError('DRIVER_CRASHED', error.message) })
      })
    })
    return { exited }
  }

  async kill(pid: number): Promise<void> {
    if (!Number.isInteger(pid) || pid <= 1) return
    await this.launch('/bin/kill', ['-TERM', String(pid)]).exited
  }
}

/**
 * No elevation: tests (fake openvpn), and Windows where the OpenVPN Interactive
 * Service owns privileges (phase 6 wires the service pipe; v1 needs an admin shell).
 */
export class DirectBroker implements PrivilegeBroker {
  constructor(private readonly onSpawn?: (child: ChildProcess) => void) {}

  launch(binary: string, args: string[]): LaunchedProcess {
    const child = spawn(binary, args, { stdio: 'ignore', windowsHide: true })
    this.onSpawn?.(child)
    const exited = new Promise<LaunchResult>((resolve) => {
      child.once('error', (error) =>
        resolve({ code: null, error: new VpnError('BINARY_MISSING', error.message) })
      )
      child.once('exit', (code) => resolve({ code }))
    })
    return { exited }
  }

  async kill(pid: number): Promise<void> {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // already gone
    }
  }
}
