import { z } from 'zod'
import type { RemoteEntry } from '../protocols/file-transfer'

export const ListDirectoryArgsSchema = z.object({
  sessionId: z.string().min(1).max(128),
  path: z.string().max(4096)
})

export type ListDirectoryArgs = z.infer<typeof ListDirectoryArgsSchema>

export const ListDirectoryFailureReasonSchema = z.enum(['invalid', 'missing', 'unavailable'])

export type ListDirectoryFailureReason = z.infer<typeof ListDirectoryFailureReasonSchema>

export type ListDirectoryResult =
  | { ok: true; entries: RemoteEntry[] }
  | { ok: false; reason: ListDirectoryFailureReason }
