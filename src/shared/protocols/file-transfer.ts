import { z } from 'zod'

export const RemoteEntryTypeSchema = z.enum(['file', 'dir', 'link', 'other'])
export type RemoteEntryType = z.infer<typeof RemoteEntryTypeSchema>

export const RemoteEntrySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  type: RemoteEntryTypeSchema,
  size: z.number().int().nonnegative(),
  modifiedAt: z.string().nullable(),
  /** `rwxr-xr-x` style; null when the backend doesn't expose it (e.g. Windows local). */
  permissions: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  group: z.string().nullable().optional()
})
export type RemoteEntry = z.infer<typeof RemoteEntrySchema>

/** What to do when a file already exists at the destination (default: overwrite). */
export const TransferConflictSchema = z.enum(['overwrite', 'skip'])
export type TransferConflict = z.infer<typeof TransferConflictSchema>

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
  remotePath: z.string().min(1),
  /** Destination on disk. When omitted, main asks with a save dialog (single file only). */
  localPath: z.string().min(1).optional(),
  /** Whether `remotePath` is a directory (transferred recursively). */
  isDir: z.boolean().optional(),
  conflict: TransferConflictSchema.optional()
})
export type FsDownloadInput = z.infer<typeof FsDownloadInputSchema>

export const FsUploadInputSchema = z.object({
  sessionId: z.string().uuid(),
  localPath: z.string().min(1),
  remotePath: z.string().min(1),
  conflict: TransferConflictSchema.optional()
})
export type FsUploadInput = z.infer<typeof FsUploadInputSchema>

export const TransferProgressSchema = z.object({
  transferId: z.string().uuid(),
  sessionId: z.string().uuid(),
  direction: z.enum(['download', 'upload']),
  remotePath: z.string(),
  localPath: z.string().optional(),
  /** File currently moving, for folder transfers. */
  currentFile: z.string().optional(),
  filesDone: z.number().int().nonnegative().optional(),
  filesTotal: z.number().int().nonnegative().optional(),
  cancelled: z.boolean().optional(),
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

export const FsCancelInputSchema = z.object({
  transferId: z.string().uuid()
})
export type FsCancelInput = z.infer<typeof FsCancelInputSchema>

/** Local-disk side of the dual-pane browser (handled entirely in main). */
export const LocalFsPathInputSchema = z.object({
  path: z.string().min(1)
})
export type LocalFsPathInput = z.infer<typeof LocalFsPathInputSchema>

export const LocalFsRenameInputSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1)
})
export type LocalFsRenameInput = z.infer<typeof LocalFsRenameInputSchema>

export type LocalFsInfo = {
  home: string
  roots: string[]
  separator: '/' | '\\'
}

export type FileTransferCapability = {
  /** Directory the server lands the user in (SFTP realpath('.'), FTP PWD). */
  home?(): Promise<string>
  list(path: string): Promise<RemoteEntry[]>
  mkdir(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
  /** Aborting `signal` interrupts the file in flight; the call then rejects. */
  download(
    remotePath: string,
    localPath: string,
    onProgress?: (bytesTransferred: number, totalBytes: number | null) => void,
    signal?: AbortSignal
  ): Promise<void>
  upload(
    localPath: string,
    remotePath: string,
    onProgress?: (bytesTransferred: number, totalBytes: number | null) => void,
    signal?: AbortSignal
  ): Promise<void>
}
