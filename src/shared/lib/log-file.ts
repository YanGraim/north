import { canonicalPosixDir, quotePosixArg, resolveStartupDirectory } from './startup-directory'

export const LOG_FILE_LIMIT = 8
export const LOG_FOLLOW_LIMIT = 8
export const TAIL_FOLLOW_LINES = 200
export const LOG_FOLLOW_RING_BYTES = 256 * 1024
const MAX_PATH_LENGTH = 4096
const MAX_LABEL_LENGTH = 80
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type LogFileDraft = {
  id: string
  path: string
  label?: string | null
}

export type NormalizedLogFile = {
  id: string
  path: string
  label: string | null
}

export type NormalizeLogFileListResult =
  | { ok: true; value: NormalizedLogFile[] }
  | { ok: false; reason: 'invalid-path' | 'duplicate' | 'invalid-label' | 'limit'; index: number }

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** Absolute POSIX path or `~` / `~/...`. Empty and relative paths are rejected. */
export function normalizeLogFilePath(input: string): { ok: true; value: string } | { ok: false } {
  const trimmed = input.trim()
  if (trimmed === '' || trimmed.length > MAX_PATH_LENGTH || hasControlChar(trimmed)) {
    return { ok: false }
  }
  const value = canonicalPosixDir(trimmed)
  if (value === '~' || value.startsWith('~/')) return { ok: true, value }
  if (value.startsWith('~') || !value.startsWith('/')) return { ok: false }
  return { ok: true, value }
}

function normalizeLabel(
  input: string | null | undefined
): { ok: true; value: string | null } | { ok: false } {
  if (input == null) return { ok: true, value: null }
  const trimmed = input.trim()
  if (trimmed === '') return { ok: true, value: null }
  if (trimmed.length > MAX_LABEL_LENGTH || hasControlChar(trimmed)) return { ok: false }
  return { ok: true, value: trimmed }
}

export function normalizeLogFileList(items: readonly LogFileDraft[]): NormalizeLogFileListResult {
  if (items.length > LOG_FILE_LIMIT) return { ok: false, reason: 'limit', index: LOG_FILE_LIMIT }
  const value: NormalizedLogFile[] = []
  const seen = new Set<string>()
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (!item || !UUID_RE.test(item.id)) return { ok: false, reason: 'invalid-path', index }
    const path = normalizeLogFilePath(item.path)
    if (!path.ok) return { ok: false, reason: 'invalid-path', index }
    const label = normalizeLabel(item.label)
    if (!label.ok) return { ok: false, reason: 'invalid-label', index }
    if (seen.has(path.value)) return { ok: false, reason: 'duplicate', index }
    seen.add(path.value)
    value.push({ id: item.id.toLowerCase(), path: path.value, label: label.value })
  }
  return { ok: true, value }
}

/** Drops invalid stored rows instead of failing the whole connection. */
export function coerceStoredLogFiles(value: unknown): NormalizedLogFile[] {
  if (!Array.isArray(value)) return []
  const drafts: LogFileDraft[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as { id?: unknown; path?: unknown; label?: unknown }
    if (typeof row.id !== 'string' || typeof row.path !== 'string') continue
    const label = typeof row.label === 'string' || row.label === null ? row.label : null
    drafts.push({ id: row.id, path: row.path, label })
  }
  const normalized = normalizeLogFileList(drafts)
  if (normalized.ok) return normalized.value
  const kept: LogFileDraft[] = []
  for (const draft of drafts) {
    const one = normalizeLogFileList([...kept, draft])
    if (one.ok) kept.push(draft)
  }
  const again = normalizeLogFileList(kept)
  return again.ok ? again.value : []
}

/**
 * Absolute path for `tail`. `~` needs the login directory from SFTP.
 * Returns null when the stored path is not usable yet.
 */
export function absoluteLogPath(stored: string, loginDirectory: string | null): string | null {
  const normalized = normalizeLogFilePath(stored)
  if (!normalized.ok) return null
  if (normalized.value.startsWith('/')) return normalized.value
  if (!loginDirectory) return null
  return resolveStartupDirectory(normalized.value, loginDirectory)
}

/** Fixed exec string. The path is one quoted argument, never interpolated raw. */
export function buildTailFollowCommand(absolutePath: string): string {
  return `tail -n ${TAIL_FOLLOW_LINES} -F -- ${quotePosixArg(absolutePath)}`
}

/** Stderr may contain control bytes. Stdout is left intact so ANSI colors still render. */
export function sanitizeLogStderr(bytes: Uint8Array): Uint8Array {
  const kept: number[] = []
  let line = 0
  const maxLine = 500
  for (const byte of bytes) {
    const newline = byte === 0x0a || byte === 0x0d
    const allowed = byte === 0x09 || newline || (byte >= 0x20 && byte !== 0x7f)
    if (!allowed) continue
    if (newline) {
      kept.push(byte)
      line = 0
      continue
    }
    if (line >= maxLine) continue
    kept.push(byte)
    line++
  }
  return Uint8Array.from(kept)
}
