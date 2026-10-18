import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { LaunchResult, PrivilegeBroker } from './privilege-broker'
import { VpnError } from './vpn-error'

/**
 * Root-owned helper (resources/vpn/north-vpn-helper) installed once with one admin
 * prompt, like FortiClient's / OpenVPN Connect's privileged services. A sudoers rule
 * lets the installing user run only that file without a password; the helper itself
 * refuses paths and non-whitelisted config, so the rule can't be used to become root.
 */
export const HELPER_DIRS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: '/Library/PrivilegedHelperTools/app.north.vpn',
  linux: '/usr/local/libexec/north-vpn'
}
export const SUDOERS_FILE = '/etc/sudoers.d/north-vpn'
const SUDO = '/usr/bin/sudo'

export type HelperStatus = 'installed' | 'missing' | 'outdated' | 'unsupported'

export type HelperFs = {
  read: (path: string) => string | null
  /** uid and mode, or null when missing */
  stat: (path: string) => { uid: number; mode: number } | null
}

export type HelperPlatform = {
  platform: NodeJS.Platform
  /** bundled helper script (asar-unpacked) */
  source: string
  user: string
  fs: HelperFs
}

/** $1 source, $2 dir, $3 user, $4 openfortivpn to copy (may be ""). One line: elevated args can't break lines. */
const INSTALL = [
  'set -e',
  'd="$2"',
  'mkdir -p "$d" /etc/sudoers.d',
  'chown 0:0 "$d"',
  'chmod 755 "$d"',
  'cp "$1" "$d/.helper"',
  'chown 0:0 "$d/.helper"',
  'chmod 755 "$d/.helper"',
  'mv -f "$d/.helper" "$d/north-vpn-helper"',
  'if [ -n "$4" ]; then cp "$4" "$d/.forti"; chown 0:0 "$d/.forti"; chmod 755 "$d/.forti"; mv -f "$d/.forti" "$d/openfortivpn"; fi',
  't=$(mktemp)',
  `printf '%s ALL=(root) NOPASSWD: %s\\n' "$3" "$d/north-vpn-helper" >"$t"`,
  'visudo -cf "$t" >/dev/null',
  'chown 0:0 "$t"',
  'chmod 440 "$t"',
  `mv -f "$t" ${SUDOERS_FILE}`
].join('; ')

const UNINSTALL = `rm -f ${SUDOERS_FILE}; rm -rf "$1"`

const SAFE_USER = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/

export function helperPaths(platform: NodeJS.Platform) {
  const dir = HELPER_DIRS[platform]
  if (!dir) return null
  return { dir, helper: join(dir, 'north-vpn-helper'), forti: join(dir, 'openfortivpn') }
}

const rootOwned = (s: { uid: number; mode: number } | null) =>
  s !== null && s.uid === 0 && (s.mode & 0o022) === 0

export function helperStatus(p: HelperPlatform, needs: { forti?: boolean } = {}): HelperStatus {
  const paths = helperPaths(p.platform)
  if (!paths) return 'unsupported'
  const installed = p.fs.read(paths.helper)
  if (installed === null || !p.fs.stat(SUDOERS_FILE)) return 'missing'
  if (!rootOwned(p.fs.stat(paths.helper)) || !rootOwned(p.fs.stat(paths.dir))) return 'outdated'
  if (installed !== p.fs.read(p.source)) return 'outdated'
  if (needs.forti && !rootOwned(p.fs.stat(paths.forti))) return 'outdated'
  return 'installed'
}

export function buildHelperInstall(
  p: HelperPlatform,
  fortiBinary: string | null
): { binary: string; args: string[] } {
  const paths = helperPaths(p.platform)
  if (!paths) throw new VpnError('UNSUPPORTED_ON_PLATFORM', 'Helper de VPN só no macOS e Linux')
  if (!SAFE_USER.test(p.user)) throw new VpnError('INVALID_CONFIG', 'Nome de usuário inválido')
  return {
    binary: '/bin/sh',
    args: ['-c', INSTALL, 'north-vpn', p.source, paths.dir, p.user, fortiBinary ?? '']
  }
}

export function buildHelperUninstall(platform: NodeJS.Platform): {
  binary: string
  args: string[]
} {
  const paths = helperPaths(platform)
  if (!paths) throw new VpnError('UNSUPPORTED_ON_PLATFORM', 'Helper de VPN só no macOS e Linux')
  return { binary: '/bin/sh', args: ['-c', UNINSTALL, 'north-vpn', paths.dir] }
}

export type HelperRun = {
  exited: Promise<LaunchResult>
  /** SIGTERM to sudo, which relays it to the helper, which stops the tunnel */
  stop(): void
}

export type HelperSpawn = (
  command: string,
  args: string[],
  input: string,
  onOutput: (chunk: Buffer) => void
) => HelperRun

/** Real spawn: `sudo -n <helper> …`, never prompts (the sudoers rule makes it passwordless). */
export const spawnHelper: HelperSpawn = (command, args, input, onOutput) => {
  const child = spawn(SUDO, ['-n', command, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdout.on('data', onOutput)
  child.stderr.on('data', onOutput)
  child.stdin.on('error', () => {})
  child.stdin.end(input)
  const exited = new Promise<LaunchResult>((resolve) => {
    child.once('error', (error) =>
      resolve({ code: null, error: new VpnError('DRIVER_CRASHED', error.message) })
    )
    child.once('exit', (code) => resolve({ code }))
  })
  return {
    exited,
    stop: () => {
      if (child.exitCode === null) child.kill('SIGTERM')
    }
  }
}

export type VpnHelperDeps = HelperPlatform & {
  broker: PrivilegeBroker
  fortiBinary: () => string | null
  spawn?: HelperSpawn
  /**
   * Copies the bundled helper somewhere root can read (macOS privacy rules block root from
   * ~/Documents etc.). The installed copy is then compared to the bundled one, so a swap
   * in between only makes the install fail.
   */
  stage?: (source: string) => string
}

export class VpnHelper {
  constructor(private readonly deps: VpnHelperDeps) {}

  status(needs: { forti?: boolean } = {}): HelperStatus {
    return helperStatus(this.deps, needs)
  }

  /** Installs (one admin prompt) unless already installed. Throws PRIVILEGE_DENIED on cancel. */
  async ensure(needs: { forti?: boolean } = {}): Promise<void> {
    const status = this.status(needs)
    if (status === 'installed') return
    if (status === 'unsupported') {
      throw new VpnError('UNSUPPORTED_ON_PLATFORM', 'Helper de VPN só no macOS e Linux')
    }
    await this.install()
    if (this.status(needs) !== 'installed') {
      throw new VpnError('DRIVER_CRASHED', 'Não foi possível instalar o componente de VPN do North')
    }
  }

  async install(): Promise<void> {
    const forti = this.deps.fortiBinary()
    const source = this.deps.stage?.(this.deps.source) ?? this.deps.source
    const { binary, args } = buildHelperInstall({ ...this.deps, source }, forti)
    const result = await this.deps.broker.launch(binary, args).exited
    if (result.error) throw result.error
  }

  async uninstall(): Promise<void> {
    if (this.status() === 'missing' || this.status() === 'unsupported') return
    const { binary, args } = buildHelperUninstall(this.deps.platform)
    const result = await this.deps.broker.launch(binary, args).exited
    if (result.error) throw result.error
  }

  startForti(config: string, onOutput: (chunk: Buffer) => void): HelperRun {
    const paths = helperPaths(this.deps.platform)
    if (!paths) throw new VpnError('UNSUPPORTED_ON_PLATFORM', 'Helper de VPN só no macOS e Linux')
    return (this.deps.spawn ?? spawnHelper)(paths.helper, ['forti'], config, onOutput)
  }

  /** Boot cleanup after a crash — no prompt; silently skipped when not installed. */
  async stopAll(): Promise<void> {
    const paths = helperPaths(this.deps.platform)
    if (!paths || this.status() === 'missing') return
    await (this.deps.spawn ?? spawnHelper)(paths.helper, ['stop-all'], '', () => {}).exited
  }
}
