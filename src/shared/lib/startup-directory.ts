import { shellQuote } from './shell-quote'

const MAX_LENGTH = 4096

export type NormalizedStartupDirectory = { ok: true; value: string | null } | { ok: false }

export type StartupDirectoryPlan =
  | { kind: 'none' }
  | { kind: 'cd'; command: string }
  | { kind: 'notice'; message: string }

export const STARTUP_DIRECTORY_INVALID_NOTICE =
  'Diretório inicial inválido. A sessão abriu no diretório de login.'

/** Single-quotes one POSIX argument. Delegates to `shellQuote` so the escape stays in one place. */
export function quotePosixArg(value: string): string {
  return shellQuote(value)
}

export function startupDirectoryUnavailableNotice(path: string): string {
  return `Diretório inicial indisponível (${path}). A sessão abriu no diretório de login.`
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** Drops trailing slashes. `/` stays `/`. `~/` becomes `~`. */
export function canonicalPosixDir(path: string): string {
  if (path === '/' || path === '~' || path === '') return path === '' ? '/' : path
  let end = path.length
  while (end > 1 && path.charCodeAt(end - 1) === 0x2f) end--
  const sliced = path.slice(0, end)
  return sliced === '' ? '/' : sliced
}

/**
 * Trims, turns blank into null, and accepts only an absolute POSIX path or `~` / `~/...`.
 * `~other` and relative paths are rejected. Control characters are rejected.
 */
export function normalizeStartupDirectory(
  input: string | null | undefined
): NormalizedStartupDirectory {
  if (input == null) return { ok: true, value: null }
  const trimmed = input.trim()
  if (trimmed === '') return { ok: true, value: null }
  if (trimmed.length > MAX_LENGTH || hasControlChar(trimmed)) return { ok: false }
  const value = canonicalPosixDir(trimmed)
  if (value === '~' || value.startsWith('~/')) return { ok: true, value }
  if (value.startsWith('~') || !value.startsWith('/')) return { ok: false }
  return { ok: true, value }
}

/** Resolves `~` and `~/...` against the login directory. Absolute paths pass through. */
export function resolveStartupDirectory(stored: string, loginDirectory: string): string {
  const login = canonicalPosixDir(loginDirectory)
  if (stored === '~') return login
  if (stored.startsWith('~/')) {
    const rest = stored.slice(2).replace(/^\/+/, '')
    if (!rest) return login
    return login === '/' ? `/${rest}` : `${login}/${rest}`
  }
  return canonicalPosixDir(stored)
}

export function startupCdCommand(absolutePath: string): string {
  return `cd -- ${quotePosixArg(absolutePath)}\r`
}

/** Used only when SFTP cannot resolve `~`. The user path stays inside single quotes. */
export function startupCdCommandFromHome(rest: string): string {
  const tail = rest.replace(/^\/+/, '')
  return `cd -- "$HOME"${quotePosixArg(`/${tail}`)}\r`
}

/**
 * What the shell should do after auth.
 * `probe.status === 'unavailable'` means the SFTP subsystem did not open, so the directory
 * could not be checked. A failed stat is `ready` with `targetIsDirectory: false`.
 */
export function planStartupDirectory(options: {
  raw: string | null
  probe:
    | { status: 'unavailable' }
    | { status: 'ready'; loginDirectory: string; targetIsDirectory: boolean }
}): StartupDirectoryPlan {
  const normalized = normalizeStartupDirectory(options.raw)
  if (!normalized.ok) return { kind: 'notice', message: STARTUP_DIRECTORY_INVALID_NOTICE }
  if (normalized.value === null) return { kind: 'none' }
  const stored = normalized.value

  if (options.probe.status === 'unavailable') {
    if (stored === '~') return { kind: 'none' }
    if (stored.startsWith('~/')) {
      return { kind: 'cd', command: startupCdCommandFromHome(stored.slice(2)) }
    }
    return { kind: 'cd', command: startupCdCommand(stored) }
  }

  const target = resolveStartupDirectory(stored, options.probe.loginDirectory)
  const login = canonicalPosixDir(options.probe.loginDirectory)
  if (canonicalPosixDir(target) === login) return { kind: 'none' }
  if (!options.probe.targetIsDirectory) {
    return { kind: 'notice', message: startupDirectoryUnavailableNotice(stored) }
  }
  return { kind: 'cd', command: startupCdCommand(target) }
}
