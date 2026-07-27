import { z } from 'zod'

export const RemoteEntryTypeSchema = z.enum(['file', 'dir', 'link', 'other'])
export type RemoteEntryType = z.infer<typeof RemoteEntryTypeSchema>

export const RemoteEntrySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  type: RemoteEntryTypeSchema,
  size: z.number().int().nonnegative(),
  modifiedAt: z.string().nullable()
})
export type RemoteEntry = z.infer<typeof RemoteEntrySchema>

export const FsListInputSchema = z.object({
  sessionId: z.string().uuid(),
  path: z.string().min(1)
})
export type FsListInput = z.infer<typeof FsListInputSchema>

export const FsPathInputSchema = z.object({
  sessionId: z.string().uuid(),
  path: z.string().min(1)
})
export type FsPathInput = z.infer<typeof FsPathInputSchema>

export const FsRenameInputSchema = z.object({
  sessionId: z.string().uuid(),
  from: z.string().min(1),
  to: z.string().min(1)
})
export type FsRenameInput = z.infer<typeof FsRenameInputSchema>

export const FsDownloadInputSchema = z.object({
  sessionId: z.string().uuid(),
  remotePath: z.string().min(1)
})
export type FsDownloadInput = z.infer<typeof FsDownloadInputSchema>

export const FsUploadInputSchema = z.object({
  sessionId: z.string().uuid(),
  localPath: z.string().min(1),
  remotePath: z.string().min(1)
})
export type FsUploadInput = z.infer<typeof FsUploadInputSchema>

export const TransferProgressSchema = z.object({
  transferId: z.string().uuid(),
  sessionId: z.string().uuid(),
  direction: z.enum(['download', 'upload']),
  remotePath: z.string(),
  bytesTransferred: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative().nullable(),
  done: z.boolean(),
  error: z.string().nullable().optional()
})
export type TransferProgress = z.infer<typeof TransferProgressSchema>

export const TransferHandleSchema = z.object({
  transferId: z.string().uuid()
})
export type TransferHandle = z.infer<typeof TransferHandleSchema>

export type FileTransferCapability = {
  list(path: string): Promise<RemoteEntry[]>
  mkdir(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
  download(
    remotePath: string,
    localPath: string,
    onProgress?: (bytesTransferred: number, totalBytes: number | null) => void
  ): Promise<void>
  upload(
    localPath: string,
    remotePath: string,
    onProgress?: (bytesTransferred: number, totalBytes: number | null) => void
  ): Promise<void>
}
