import type { ListDirectoryResult } from '@shared/lib/list-directory'
import { isSafePosixAbsolute } from '@shared/lib/selection-path'
import { canonicalPosixDir } from '@shared/lib/startup-directory'
import { RemoteEntrySchema } from '@shared/protocols'
import type { Client, FileEntryWithStats, SFTPWrapper } from 'ssh2'
import { mapSftpDirectoryEntries } from './sftp-entries'

/** ssh2 sets `error.code` to the SFTP status. 2 is SSH_FX_NO_SUCH_FILE. The message is never forwarded. */
const SFTP_NO_SUCH_FILE = 2

function isNoSuchFile(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return (error as { code: unknown }).code === SFTP_NO_SUCH_FILE
}

export function prepareSessionDirectoryList(input: {
  path: string
  protocol: string | null
  connectionId: string | null
  canList: boolean
}): { ok: true; path: string } | { ok: false; reason: 'invalid' | 'unavailable' } {
  if (!isSafePosixAbsolute(input.path)) return { ok: false, reason: 'invalid' }
  const path = canonicalPosixDir(input.path)
  if (!isSafePosixAbsolute(path)) return { ok: false, reason: 'invalid' }
  if (input.protocol !== 'ssh' || !input.connectionId || !input.canList) {
    return { ok: false, reason: 'unavailable' }
  }
  return { ok: true, path }
}

/**
 * Short-lived SFTP `readdir` on the client that already owns the shell.
 * Does not touch the PTY and does not forward ssh2 errors.
 */
export async function listRemoteDirectory(
  client: Client,
  path: string,
  isCancelled: () => boolean
): Promise<ListDirectoryResult> {
  if (isCancelled()) return { ok: false, reason: 'unavailable' }
  if (!isSafePosixAbsolute(path)) return { ok: false, reason: 'invalid' }
  const target = canonicalPosixDir(path)
  if (!isSafePosixAbsolute(target)) return { ok: false, reason: 'invalid' }

  let sftp: SFTPWrapper
  try {
    sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((err, channel) => (err ? reject(err) : resolve(channel)))
    })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }

  try {
    if (isCancelled()) return { ok: false, reason: 'unavailable' }
    const listed = await new Promise<FileEntryWithStats[]>((resolve, reject) => {
      sftp.readdir(target, (err, entries) => (err ? reject(err) : resolve(entries)))
    })
    const entries = mapSftpDirectoryEntries(target, listed).filter(
      (entry) => RemoteEntrySchema.safeParse(entry).success
    )
    return { ok: true, entries }
  } catch (error) {
    if (isNoSuchFile(error)) return { ok: false, reason: 'missing' }
    return { ok: false, reason: 'unavailable' }
  } finally {
    try {
      sftp.end()
    } catch {
      // The auxiliary channel is best-effort.
    }
  }
}
