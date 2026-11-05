import { z } from 'zod'

/** First bytes inspected for a NUL. A text editor stops at a binary file. */
export const REMOTE_EDIT_SAMPLE_BYTES = 8 * 1024

/** Larger than this, the editor does not open and nothing is uploaded. */
export const REMOTE_EDIT_MAX_BYTES = 8 * 1024 * 1024

export type RemoteEditClass = 'text' | 'binary' | 'too-large'

/**
 * Classifies a remote file from its size and a prefix sample.
 * Empty is text. A NUL in the first 8 KiB is binary. Size above 8 MiB wins over both.
 */
export function classifyRemoteEdit(size: number, sample: Uint8Array): RemoteEditClass {
  if (!Number.isFinite(size) || size < 0) return 'binary'
  if (size > REMOTE_EDIT_MAX_BYTES) return 'too-large'
  const limit = Math.min(sample.length, REMOTE_EDIT_SAMPLE_BYTES, size)
  for (let index = 0; index < limit; index++) {
    if (sample[index] === 0) return 'binary'
  }
  return 'text'
}

/** Absolute path the main process may spawn. Relative paths and newlines are refused. */
export function isAbsoluteExecutable(value: string): boolean {
  if (!value || value.includes('\0') || /[\r\n]/.test(value)) return false
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)
}

export type ExternalEditorSpawn = {
  command: string
  args: readonly [string]
  shell: false
}

/**
 * One argument, the temp file. The remote path never enters the list, and the shell stays off.
 * Returns null when the executable or the temp path is not an absolute file path.
 */
export function planExternalEditorSpawn(input: {
  executable: string
  tempPath: string
  remotePath: string
}): ExternalEditorSpawn | null {
  if (!isAbsoluteExecutable(input.executable) || !isAbsoluteExecutable(input.tempPath)) return null
  if (input.tempPath === input.remotePath) return null
  const args = [input.tempPath] as const
  if (args.some((arg) => arg === input.remotePath)) return null
  return { command: input.executable, args, shell: false }
}

export const ExternalEditorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  executable: z.string().trim().min(1).max(1024)
})
export type ExternalEditor = z.infer<typeof ExternalEditorSchema>

export const SaveExternalEditorsInputSchema = z.object({
  editors: z.array(ExternalEditorSchema).max(32)
})
export type SaveExternalEditorsInput = z.infer<typeof SaveExternalEditorsInputSchema>

export type SaveExternalEditorsResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'missing-executable' }

/** Names and ids must be unique, and every executable must be an absolute path. */
export function validateExternalEditorList(editors: ExternalEditor[]): 'ok' | 'invalid' {
  const names = new Set<string>()
  const ids = new Set<string>()
  for (const editor of editors) {
    if (!isAbsoluteExecutable(editor.executable)) return 'invalid'
    if (names.has(editor.name) || ids.has(editor.id)) return 'invalid'
    names.add(editor.name)
    ids.add(editor.id)
  }
  return 'ok'
}

export const FsEditOpenInputSchema = z.object({
  sessionId: z.string().uuid(),
  remotePath: z.string().min(1).max(4096),
  editorId: z.string().min(1).max(80)
})
export type FsEditOpenInput = z.infer<typeof FsEditOpenInputSchema>

export type FsEditOpenReason =
  | 'not-file'
  | 'binary'
  | 'too-large'
  | 'unavailable'
  | 'editor-missing'

export type FsEditOpenResult =
  | { ok: true; editId: string; remotePath: string; content?: string }
  | { ok: false; reason: FsEditOpenReason }

export const FsEditSaveInputSchema = z.object({
  sessionId: z.string().uuid(),
  editId: z.string().uuid(),
  content: z.string()
})
export type FsEditSaveInput = z.infer<typeof FsEditSaveInputSchema>

export type FsEditSaveResult = { ok: true } | { ok: false; reason: 'unavailable' | 'closed' }

export const FsEditCloseInputSchema = z.object({
  sessionId: z.string().uuid(),
  editId: z.string().uuid()
})
export type FsEditCloseInput = z.infer<typeof FsEditCloseInputSchema>

export type FsEditNotice = {
  sessionId: string
  editId: string
  remotePath: string
}
