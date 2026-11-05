import { posix } from 'node:path'
import { isSafePosixAbsolute } from '@shared/lib/selection-path'
import type { SessionMutateResult } from '@shared/lib/session-shell'
import { canonicalPosixDir } from '@shared/lib/startup-directory'
import type { FileTransferCapability, RemoteEntry } from '@shared/protocols'
import type { Client, FileEntryWithStats, SFTPWrapper, Stats } from 'ssh2'
import { mapSftpDirectoryEntries } from './sftp-entries'

const SFTP_NO_SUCH_FILE = 2
const MAX_REMOVE_DEPTH = 64

function isNoSuchFile(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return (error as { code: unknown }).code === SFTP_NO_SUCH_FILE
}

function safePath(path: string): string | null {
  if (!isSafePosixAbsolute(path)) return null
  const canonical = canonicalPosixDir(path)
  return isSafePosixAbsolute(canonical) ? canonical : null
}

function openSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((err, channel) => (err ? reject(err) : resolve(channel)))
  })
}

function endSftp(sftp: SFTPWrapper): void {
  try {
    sftp.end()
  } catch {
    // The auxiliary channel is best-effort.
  }
}

function statPath(sftp: SFTPWrapper, path: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    sftp.stat(path, (err, stats) => (err ? reject(err) : resolve(stats)))
  })
}

function readDirectory(sftp: SFTPWrapper, path: string): Promise<FileEntryWithStats[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, entries) => (err ? reject(err) : resolve(entries)))
  })
}

export async function captureLoginDirectory(
  client: Client,
  isCancelled: () => boolean
): Promise<string | null> {
  if (isCancelled()) return null
  let sftp: SFTPWrapper
  try {
    sftp = await openSftp(client)
  } catch {
    return null
  }
  try {
    if (isCancelled()) return null
    const login = await new Promise<string>((resolve, reject) => {
      sftp.realpath('.', (err, path) => (err ? reject(err) : resolve(path)))
    })
    const path = canonicalPosixDir(login)
    return isSafePosixAbsolute(path) ? path : null
  } catch {
    return null
  } finally {
    endSftp(sftp)
  }
}

async function withSftp<T>(
  client: Client,
  isCancelled: () => boolean,
  run: (sftp: SFTPWrapper) => Promise<T>
): Promise<T | SessionMutateResult> {
  if (isCancelled()) return { ok: false, reason: 'unavailable' }
  let sftp: SFTPWrapper
  try {
    sftp = await openSftp(client)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  try {
    if (isCancelled()) return { ok: false, reason: 'unavailable' }
    return await run(sftp)
  } catch (error) {
    if (isNoSuchFile(error)) return { ok: false, reason: 'missing' }
    return { ok: false, reason: 'unavailable' }
  } finally {
    endSftp(sftp)
  }
}

export async function mkdirOnSession(
  client: Client,
  path: string,
  isCancelled: () => boolean
): Promise<SessionMutateResult> {
  const target = safePath(path)
  if (target == null) return { ok: false, reason: 'invalid' }
  const result = await withSftp(client, isCancelled, (sftp) => {
    return new Promise<SessionMutateResult>((resolve, reject) => {
      sftp.mkdir(target, (err) => (err ? reject(err) : resolve({ ok: true })))
    })
  })
  return result
}

export async function renameOnSession(
  client: Client,
  from: string,
  to: string,
  isCancelled: () => boolean
): Promise<SessionMutateResult> {
  const source = safePath(from)
  const target = safePath(to)
  if (source == null || target == null) return { ok: false, reason: 'invalid' }
  const result = await withSftp(client, isCancelled, (sftp) => {
    return new Promise<SessionMutateResult>((resolve, reject) => {
      sftp.rename(source, target, (err) => (err ? reject(err) : resolve({ ok: true })))
    })
  })
  return result
}

async function removeTree(sftp: SFTPWrapper, path: string, depth: number): Promise<void> {
  if (depth > MAX_REMOVE_DEPTH) throw new Error('unavailable')
  const stats = await statPath(sftp, path)
  if (!stats.isDirectory()) {
    await new Promise<void>((resolve, reject) => {
      sftp.unlink(path, (err) => (err ? reject(err) : resolve()))
    })
    return
  }
  const entries = await readDirectory(sftp, path)
  for (const entry of entries) {
    if (entry.filename === '.' || entry.filename === '..' || entry.filename.length === 0) continue
    await removeTree(sftp, posix.join(path, entry.filename), depth + 1)
  }
  await new Promise<void>((resolve, reject) => {
    sftp.rmdir(path, (err) => (err ? reject(err) : resolve()))
  })
}

export async function removeOnSession(
  client: Client,
  path: string,
  isCancelled: () => boolean
): Promise<SessionMutateResult> {
  const target = safePath(path)
  if (target == null || target === '/') return { ok: false, reason: 'invalid' }
  const result = await withSftp(client, isCancelled, async (sftp) => {
    await removeTree(sftp, target, 0)
    return { ok: true } as const
  })
  return result
}

/**
 * One SFTP channel for a whole transfer. The caller closes it when the transfer settles.
 * Failures throw a generic error so the ssh2 message never reaches the renderer.
 */
export async function openSessionFileTransfer(
  client: Client,
  isCancelled: () => boolean
): Promise<
  | { ok: true; transfer: FileTransferCapability; close: () => void }
  | { ok: false; reason: 'unavailable' }
> {
  if (isCancelled()) return { ok: false, reason: 'unavailable' }
  let sftp: SFTPWrapper
  try {
    sftp = await openSftp(client)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  const refused = (): Error => new Error('unavailable')
  const transfer: FileTransferCapability = {
    async list(path: string): Promise<RemoteEntry[]> {
      const target = safePath(path)
      if (target == null || isCancelled()) throw refused()
      try {
        const entries = await readDirectory(sftp, target)
        return mapSftpDirectoryEntries(target, entries)
      } catch {
        throw refused()
      }
    },
    async mkdir(path: string): Promise<void> {
      const target = safePath(path)
      if (target == null || isCancelled()) throw refused()
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir(target, (err) => (err ? reject(refused()) : resolve()))
      })
    },
    async rename(): Promise<void> {
      throw refused()
    },
    async remove(path: string): Promise<void> {
      const target = safePath(path)
      if (target == null || target === '/' || isCancelled()) throw refused()
      try {
        await removeTree(sftp, target, 0)
      } catch {
        throw refused()
      }
    },
    download(remotePath, localPath, onProgress, signal) {
      const target = safePath(remotePath)
      if (target == null || isCancelled()) return Promise.reject(refused())
      if (signal?.aborted) return Promise.reject(refused())
      return new Promise((resolve, reject) => {
        const onAbort = (): void => reject(refused())
        signal?.addEventListener('abort', onAbort, { once: true })
        sftp.fastGet(
          target,
          localPath,
          {
            step: (total, _nb, fsize) => {
              onProgress?.(total, fsize && fsize > 0 ? fsize : null)
            }
          },
          (err) => {
            signal?.removeEventListener('abort', onAbort)
            if (err) reject(refused())
            else resolve()
          }
        )
      })
    },
    upload(localPath, remotePath, onProgress, signal) {
      const target = safePath(remotePath)
      if (target == null || isCancelled()) return Promise.reject(refused())
      if (signal?.aborted) return Promise.reject(refused())
      return new Promise((resolve, reject) => {
        const onAbort = (): void => reject(refused())
        signal?.addEventListener('abort', onAbort, { once: true })
        sftp.fastPut(
          localPath,
          target,
          {
            step: (total, _nb, fsize) => {
              onProgress?.(total, fsize && fsize > 0 ? fsize : null)
            }
          },
          (err) => {
            signal?.removeEventListener('abort', onAbort)
            if (err) reject(refused())
            else resolve()
          }
        )
      })
    }
  }
  return { ok: true, transfer, close: () => endSftp(sftp) }
}
