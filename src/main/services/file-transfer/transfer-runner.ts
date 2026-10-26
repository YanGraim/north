import { access, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { basename, join, posix } from 'node:path'
import type { FileTransferCapability, TransferConflict } from '@shared/protocols'

type RemoteOps = Pick<FileTransferCapability, 'list' | 'mkdir' | 'remove' | 'download' | 'upload'>

export type TransferFile = { remote: string; local: string; size: number | null }

/** Everything a transfer will touch, resolved up front so progress has a real total. */
export type TransferPlan = {
  /** Directories to create on the destination side, parents first. */
  dirs: string[]
  files: TransferFile[]
}

export type TransferUpdate = {
  currentFile: string
  filesDone: number
  filesTotal: number
  bytesTransferred: number
  totalBytes: number | null
}

export class TransferCancelledError extends Error {
  constructor() {
    super('Transferência cancelada')
    this.name = 'TransferCancelledError'
  }
}

export async function planDownload(
  ft: RemoteOps,
  remotePath: string,
  localPath: string,
  isDir: boolean
): Promise<TransferPlan> {
  const plan: TransferPlan = { dirs: [], files: [] }
  if (!isDir) {
    plan.files.push({ remote: remotePath, local: localPath, size: null })
    return plan
  }
  async function walk(remote: string, local: string): Promise<void> {
    plan.dirs.push(local)
    for (const entry of await ft.list(remote)) {
      if (entry.name === '.' || entry.name === '..') continue
      const target = join(local, entry.name)
      if (entry.type === 'dir') await walk(entry.path, target)
      else if (entry.type === 'file' || entry.type === 'link') {
        plan.files.push({ remote: entry.path, local: target, size: entry.size })
      }
    }
  }
  await walk(remotePath, localPath)
  return plan
}

export async function planUpload(localPath: string, remotePath: string): Promise<TransferPlan> {
  const plan: TransferPlan = { dirs: [], files: [] }
  const info = await stat(localPath)
  if (!info.isDirectory()) {
    plan.files.push({ remote: remotePath, local: localPath, size: info.size })
    return plan
  }
  async function walk(local: string, remote: string): Promise<void> {
    plan.dirs.push(remote)
    for (const entry of await readdir(local, { withFileTypes: true })) {
      const source = join(local, entry.name)
      const target = posix.join(remote, entry.name)
      if (entry.isDirectory()) await walk(source, target)
      else if (entry.isFile()) {
        const size = await stat(source).then(
          (s) => s.size,
          () => null
        )
        plan.files.push({ remote: target, local: source, size })
      }
    }
  }
  await walk(localPath, remotePath)
  return plan
}

function sumSizes(files: TransferFile[]): number | null {
  let total = 0
  for (const file of files) {
    if (file.size == null) return null
    total += file.size
  }
  return total
}

/**
 * Answers "is there already a file at this destination?" — local disk for
 * downloads, one cached listing per remote folder for uploads.
 */
export function destinationExists(
  ft: RemoteOps,
  direction: 'download' | 'upload'
): (file: TransferFile) => Promise<boolean> {
  if (direction === 'download') {
    return (file) =>
      access(file.local).then(
        () => true,
        () => false
      )
  }
  const listings = new Map<string, Promise<Set<string>>>()
  return async (file) => {
    const dir = posix.dirname(file.remote)
    let names = listings.get(dir)
    if (!names) {
      names = ft.list(dir).then(
        (entries) => new Set(entries.map((e) => e.name)),
        () => new Set<string>()
      )
      listings.set(dir, names)
    }
    return (await names).has(posix.basename(file.remote))
  }
}

/**
 * Runs a plan file by file. Cancelling aborts the file in flight (the drivers
 * honour the signal) and removes its partial copy; the rest are skipped.
 */
export async function runTransfer(opts: {
  ft: RemoteOps
  direction: 'download' | 'upload'
  plan: TransferPlan
  signal: AbortSignal
  onProgress: (update: TransferUpdate) => void
  conflict?: TransferConflict
  exists?: (file: TransferFile) => Promise<boolean>
}): Promise<void> {
  const { ft, direction, plan, signal, onProgress } = opts
  const exists = opts.exists ?? destinationExists(ft, direction)
  for (const dir of plan.dirs) {
    if (signal.aborted) throw new TransferCancelledError()
    if (direction === 'download') {
      await mkdir(dir, { recursive: true })
    } else {
      // The folder may already exist remotely; a real failure surfaces on the upload itself.
      await ft.mkdir(dir).catch(() => undefined)
    }
  }

  const filesTotal = plan.files.length
  let totalBytes = sumSizes(plan.files)
  let doneBytes = 0
  for (const [index, file] of plan.files.entries()) {
    if (signal.aborted) throw new TransferCancelledError()
    const name = basename(direction === 'download' ? file.remote : file.local)
    const step = (bytes: number, fileTotal: number | null): void => {
      // A single file of unknown size learns its total from the driver.
      if (filesTotal === 1 && totalBytes == null && fileTotal != null) totalBytes = fileTotal
      onProgress({
        currentFile: name,
        filesDone: index,
        filesTotal,
        bytesTransferred: doneBytes + bytes,
        totalBytes
      })
    }
    if (opts.conflict === 'skip' && (await exists(file))) {
      doneBytes += file.size ?? 0
      continue
    }
    step(0, null)
    try {
      if (direction === 'download') await ft.download(file.remote, file.local, step, signal)
      else await ft.upload(file.local, file.remote, step, signal)
    } catch (error) {
      if (!signal.aborted) throw error
      // Never leave a half-written file behind that looks like the real one.
      if (direction === 'download') await unlink(file.local).catch(() => undefined)
      else await ft.remove(file.remote).catch(() => undefined)
      throw new TransferCancelledError()
    }
    doneBytes += file.size ?? 0
  }
  onProgress({
    currentFile: '',
    filesDone: filesTotal,
    filesTotal,
    bytesTransferred: totalBytes ?? doneBytes,
    totalBytes
  })
}
