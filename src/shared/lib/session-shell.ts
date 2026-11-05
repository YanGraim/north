import { z } from 'zod'
import { TransferConflictSchema } from '../protocols/file-transfer'

const sessionId = z.string().min(1).max(128)
const remotePath = z.string().min(1).max(4096)

export const SessionPathInputSchema = z.object({
  sessionId,
  path: remotePath
})
export type SessionPathInput = z.infer<typeof SessionPathInputSchema>

export const SessionRenameInputSchema = z.object({
  sessionId,
  from: remotePath,
  to: remotePath
})
export type SessionRenameInput = z.infer<typeof SessionRenameInputSchema>

export const SessionIdInputSchema = z.object({
  sessionId
})
export type SessionIdInput = z.infer<typeof SessionIdInputSchema>

export const SessionDownloadInputSchema = z.object({
  sessionId,
  remotePath,
  isDir: z.boolean(),
  conflict: TransferConflictSchema.optional(),
  destinationToken: z.string().uuid().optional()
})
export type SessionDownloadInput = z.infer<typeof SessionDownloadInputSchema>

export const SessionUploadInputSchema = z.object({
  sessionId,
  localPaths: z.array(z.string().min(1).max(4096)).max(100).optional(),
  conflict: TransferConflictSchema.optional(),
  destinationToken: z.string().uuid().optional()
})
export type SessionUploadInput = z.infer<typeof SessionUploadInputSchema>

export type ChangeDirectoryResult =
  | { ok: true; pending: boolean }
  | { ok: false; reason: 'invalid' | 'unavailable' }

export type SessionHomeResult = { ok: true; path: string } | { ok: false; reason: 'unavailable' }

export type SessionMutateResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'missing' | 'unavailable' }

export type SessionTransferResult =
  | { ok: true; transferId: string; destinationToken: string }
  | {
      ok: false
      reason: 'cancelled' | 'invalid' | 'unavailable' | 'conflict'
      names?: string[]
      destinationToken?: string
    }
