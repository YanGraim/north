import { constants } from 'node:fs'
import { access, lstat, mkdir, readdir, rename, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, sep } from 'node:path'
import type { LocalFsInfo, RemoteEntry, RemoteEntryType } from '@shared/protocols'

/** `0o100755` → `rwxr-xr-x` (only the permission bits are rendered). */
export function formatMode(mode: number): string {
  const chars = 'rwxrwxrwx'
  let out = ''
  for (let i = 0; i < 9; i++) {
    out += mode & (1 << (8 - i)) ? chars[i] : '-'
  }
  return out
}

export function requireAbsolute(path: string): string {
  if (!isAbsolute(path)) {
    throw new Error('Caminho local precisa ser absoluto')
  }
  return path
}

export async function listLocal(dir: string): Promise<RemoteEntry[]> {
  requireAbsolute(dir)
  const names = await readdir(dir)
  const entries = await Promise.all(
    names.map(async (name): Promise<RemoteEntry | null> => {
      const full = join(dir, name)
      try {
        const link = await lstat(full)
        // Follow symlinks for type/size so a link to a folder navigates like one.
        const info = link.isSymbolicLink() ? await stat(full).catch(() => link) : link
        let type: RemoteEntryType = 'other'
        if (info.isDirectory()) type = 'dir'
        else if (info.isFile()) type = 'file'
        else if (info.isSymbolicLink()) type = 'link'
        return {
          name,
          path: full,
          type,
          size: type === 'file' ? info.size : 0,
          modifiedAt: info.mtime.toISOString(),
          permissions: process.platform === 'win32' ? null : formatMode(info.mode),
          owner: process.platform === 'win32' ? null : String(info.uid),
          group: process.platform === 'win32' ? null : String(info.gid)
        }
      } catch {
        // Unreadable entry (permission denied, broken mount) — skip instead of failing the list.
        return null
      }
    })
  )
  return entries.filter((entry): entry is RemoteEntry => entry !== null)
}

async function windowsDrives(): Promise<string[]> {
  const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZAB'.split('')
  const found = await Promise.all(
    letters.map(async (letter) => {
      const root = `${letter}:\\`
      try {
        await access(root, constants.F_OK)
        return root
      } catch {
        return null
      }
    })
  )
  return found.filter((root): root is string => root !== null)
}

export async function localFsInfo(): Promise<LocalFsInfo> {
  if (process.platform === 'win32') {
    return { home: homedir(), roots: await windowsDrives(), separator: '\\' }
  }
  return { home: homedir(), roots: ['/'], separator: sep === '\\' ? '\\' : '/' }
}

export async function mkdirLocal(path: string): Promise<void> {
  await mkdir(requireAbsolute(path), { recursive: true })
}

export async function renameLocal(from: string, to: string): Promise<void> {
  await rename(requireAbsolute(from), requireAbsolute(to))
}
