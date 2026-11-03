import { z } from 'zod'
import {
  type LogFileDraft,
  type NormalizedLogFile,
  normalizeLogFileList,
  normalizeLogFilePath
} from './log-file'
import { canonicalPosixDir, normalizeStartupDirectory, startupCdCommand } from './startup-directory'

const MAX_ABSOLUTE_LENGTH = 4096

export const PathKindSchema = z.enum(['file', 'directory', 'other', 'missing', 'unavailable'])

export type PathKind = z.infer<typeof PathKindSchema>

/** `stat` on the open SSH client. `absolute` is null when that stat did not succeed. */
export type PathStatResult = {
  kind: PathKind
  absolute: string | null
}

export const ClassifyPathArgsSchema = z.object({
  sessionId: z.string().min(1).max(128),
  path: z.string().max(MAX_ABSOLUTE_LENGTH)
})

export type ClassifyPathArgs = z.infer<typeof ClassifyPathArgsSchema>

export const ClassifyPathResultSchema = z.object({
  kind: PathKindSchema,
  path: z.string(),
  absolute: z.string().nullable()
})

export type ClassifyPathResult = z.infer<typeof ClassifyPathResultSchema>

export type StartupDirectorySelectionPlan =
  | { ok: false; reason: 'invalid' | 'missing' | 'unavailable' | 'other' }
  | {
      ok: true
      /** Selection form to persist (`~/app/file.log` → `~/app`). */
      stored: string
      /** Absolute directory passed to `startupCdCommand`. */
      absoluteDir: string
      command: string
      /** True when `stored` already equals the connection's startup directory. */
      unchanged: boolean
    }

export type LogFileSelectionPlan =
  | {
      ok: false
      reason: 'invalid' | 'missing' | 'unavailable' | 'not-file' | 'duplicate' | 'limit'
    }
  | { ok: true; id: string; path: string; files: NormalizedLogFile[] }

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** Absolute POSIX path that can be quoted into `cd`. Rejects control characters. */
export function isSafePosixAbsolute(path: string): boolean {
  if (path.length === 0 || path.length > MAX_ABSOLUTE_LENGTH || !path.startsWith('/')) return false
  return !hasControlChar(path)
}

/**
 * Parent of a POSIX path. `/file` stays `/` and `~/file` stays `~`.
 * Never climbs above `/` or `~`.
 */
export function posixParent(path: string): string {
  const value = canonicalPosixDir(path)
  if (value === '/' || value === '~') return value
  const slash = value.lastIndexOf('/')
  if (slash < 0) return value
  if (slash === 0) return '/'
  if (value.startsWith('~/') && slash === 1) return '~'
  return value.slice(0, slash)
}

/**
 * Directory action. A file persists its parent; a directory persists itself.
 * The stored value keeps the selection form. `command` cds the absolute directory.
 */
export function planStartupDirectoryFromSelection(input: {
  selection: string
  kind: PathKind
  absolute: string | null
  current: string | null
}): StartupDirectorySelectionPlan {
  const normalized = normalizeLogFilePath(input.selection)
  if (!normalized.ok) return { ok: false, reason: 'invalid' }
  if (input.kind === 'missing') return { ok: false, reason: 'missing' }
  if (input.kind === 'unavailable') return { ok: false, reason: 'unavailable' }
  if (input.kind !== 'file' && input.kind !== 'directory') return { ok: false, reason: 'other' }
  if (input.absolute == null) return { ok: false, reason: 'unavailable' }
  const absoluteSource = canonicalPosixDir(input.absolute)
  if (!isSafePosixAbsolute(absoluteSource)) return { ok: false, reason: 'unavailable' }

  const storedPath = input.kind === 'file' ? posixParent(normalized.value) : normalized.value
  const stored = normalizeStartupDirectory(storedPath)
  if (!stored.ok || stored.value == null) return { ok: false, reason: 'invalid' }

  const absoluteDir = input.kind === 'file' ? posixParent(absoluteSource) : absoluteSource
  if (!isSafePosixAbsolute(absoluteDir)) return { ok: false, reason: 'unavailable' }

  const current = normalizeStartupDirectory(input.current)
  const currentValue = current.ok ? current.value : null
  return {
    ok: true,
    stored: stored.value,
    absoluteDir,
    command: startupCdCommand(absoluteDir),
    unchanged: currentValue !== null && currentValue === stored.value
  }
}

export type StartupDirectoryPanePlan =
  | { ok: false; reason: 'invalid' }
  | { ok: true; stored: string; unchanged: boolean; needsConfirm: boolean }

/**
 * Directory action from the folder the remote pane is listing.
 * Does not build a `cd` command — the pane is already in that folder.
 */
export function planStartupDirectoryFromPane(input: {
  path: string
  current: string | null
}): StartupDirectoryPanePlan {
  const next = normalizeStartupDirectory(input.path)
  if (!next.ok || next.value == null) return { ok: false, reason: 'invalid' }

  const current = normalizeStartupDirectory(input.current)
  if (!current.ok) {
    return { ok: true, stored: next.value, unchanged: false, needsConfirm: true }
  }
  if (current.value == null) {
    return { ok: true, stored: next.value, unchanged: false, needsConfirm: false }
  }
  if (current.value === next.value) {
    return { ok: true, stored: next.value, unchanged: true, needsConfirm: false }
  }
  return { ok: true, stored: next.value, unchanged: false, needsConfirm: true }
}

/** Log action. Only a regular file is appended, with a null label. */
export function planLogFileFromSelection(input: {
  selection: string
  kind: PathKind
  existing: readonly LogFileDraft[]
  id: string
}): LogFileSelectionPlan {
  const normalized = normalizeLogFilePath(input.selection)
  if (!normalized.ok) return { ok: false, reason: 'invalid' }
  if (input.kind === 'missing') return { ok: false, reason: 'missing' }
  if (input.kind === 'unavailable') return { ok: false, reason: 'unavailable' }
  if (input.kind !== 'file') return { ok: false, reason: 'not-file' }

  const listed = normalizeLogFileList([
    ...input.existing,
    { id: input.id, path: normalized.value, label: null }
  ])
  if (!listed.ok) {
    if (listed.reason === 'duplicate' || listed.reason === 'limit') {
      return { ok: false, reason: listed.reason }
    }
    return { ok: false, reason: 'invalid' }
  }
  const added = listed.value.find((file) => file.id === input.id.toLowerCase())
  if (!added) return { ok: false, reason: 'invalid' }
  return { ok: true, id: added.id, path: added.path, files: listed.value }
}
