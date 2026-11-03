import { posix } from 'node:path'
import type { RemoteEntry, RemoteEntryType } from '@shared/protocols'
import type { FileEntryWithStats } from 'ssh2'
import { formatMode } from '../services/file-transfer/local-fs'

function toEntryType(stats: FileEntryWithStats['attrs']): RemoteEntryType {
  if (stats.isDirectory()) return 'dir'
  if (stats.isSymbolicLink()) return 'link'
  if (stats.isFile()) return 'file'
  return 'other'
}

function normalizeMtime(mtime: number | undefined | null): string | null {
  if (typeof mtime !== 'number' || !Number.isFinite(mtime) || mtime <= 0) return null
  return new Date(mtime * 1000).toISOString()
}

/** Owner/group names from the `ls -l`-style longname; uids are the fallback. */
export function parseLongnameOwner(longname: string | undefined): {
  owner: string
  group: string
} | null {
  const parts = longname?.trim().split(/\s+/) ?? []
  if (parts.length < 4) return null
  return { owner: parts[2], group: parts[3] }
}

/** Same row shape as `SftpDriver.list`. */
export function mapSftpDirectoryEntries(
  directory: string,
  entries: readonly FileEntryWithStats[]
): RemoteEntry[] {
  const mapped: RemoteEntry[] = []
  for (const entry of entries) {
    if (entry.filename.length === 0) continue
    const names = parseLongnameOwner(entry.longname)
    mapped.push({
      name: entry.filename,
      path: posix.join(directory, entry.filename),
      type: toEntryType(entry.attrs),
      size: entry.attrs.size ?? 0,
      modifiedAt: normalizeMtime(entry.attrs.mtime),
      permissions: typeof entry.attrs.mode === 'number' ? formatMode(entry.attrs.mode) : null,
      owner: names?.owner ?? (entry.attrs.uid != null ? String(entry.attrs.uid) : null),
      group: names?.group ?? (entry.attrs.gid != null ? String(entry.attrs.gid) : null)
    })
  }
  return mapped
}
