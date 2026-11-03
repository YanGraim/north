import type { Client, FileEntryWithStats, SFTPWrapper } from 'ssh2'
import { describe, expect, it } from 'vitest'
import { listRemoteDirectory, prepareSessionDirectoryList } from './ssh-directory-list'

function attrs(
  type: 'file' | 'dir' | 'link',
  mode: number,
  size = 0,
  mtime = 0
): FileEntryWithStats['attrs'] {
  return {
    mode,
    uid: 1000,
    gid: 1000,
    size,
    atime: mtime,
    mtime,
    isDirectory: () => type === 'dir',
    isFile: () => type === 'file',
    isSymbolicLink: () => type === 'link',
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false
  }
}

function entry(
  filename: string,
  type: 'file' | 'dir' | 'link',
  longname: string
): FileEntryWithStats {
  return {
    filename,
    longname,
    attrs: attrs(type, type === 'dir' ? 0o40755 : 0o100644, type === 'file' ? 12 : 0, 1_700_000_000)
  }
}

function fakeClient(behavior: {
  openError?: boolean
  missing?: boolean
  fail?: boolean
  entries?: FileEntryWithStats[]
}): { client: Client; ended: () => number; opened: () => number } {
  let ended = 0
  let opened = 0
  const client = {
    sftp(callback: (err: Error | undefined, sftp: SFTPWrapper) => void) {
      opened += 1
      if (behavior.openError) {
        callback(new Error('subsystem refused'), undefined as unknown as SFTPWrapper)
        return
      }
      const sftp = {
        readdir(
          _location: string,
          cb: (err: Error | undefined, list: FileEntryWithStats[]) => void
        ) {
          if (behavior.missing) {
            const error = Object.assign(new Error('no such file'), { code: 2 })
            cb(error, [])
            return
          }
          if (behavior.fail) {
            cb(new Error('permission denied'), [])
            return
          }
          cb(undefined, behavior.entries ?? [])
        },
        end() {
          ended += 1
        }
      }
      callback(undefined, sftp as unknown as SFTPWrapper)
    }
  }
  return {
    client: client as unknown as Client,
    ended: () => ended,
    opened: () => opened
  }
}

describe('prepareSessionDirectoryList', () => {
  it('accepts a safe absolute path only for an SSH session with a connection', () => {
    expect(
      prepareSessionDirectoryList({
        path: '/var/log/',
        protocol: 'ssh',
        connectionId: 'connection-1',
        canList: true
      })
    ).toEqual({ ok: true, path: '/var/log' })
  })

  it('rejects an empty or relative path instead of listing /', () => {
    expect(
      prepareSessionDirectoryList({
        path: '',
        protocol: 'ssh',
        connectionId: 'connection-1',
        canList: true
      })
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(
      prepareSessionDirectoryList({
        path: 'var/log',
        protocol: 'ssh',
        connectionId: 'connection-1',
        canList: true
      }).ok
    ).toBe(false)
  })

  it('refuses a session that is not the saved SSH shell', () => {
    expect(
      prepareSessionDirectoryList({
        path: '/var',
        protocol: 'ftp',
        connectionId: 'connection-1',
        canList: true
      })
    ).toEqual({ ok: false, reason: 'unavailable' })
    expect(
      prepareSessionDirectoryList({
        path: '/var',
        protocol: 'ssh',
        connectionId: null,
        canList: true
      })
    ).toEqual({ ok: false, reason: 'unavailable' })
    expect(
      prepareSessionDirectoryList({
        path: '/var',
        protocol: 'ssh',
        connectionId: 'connection-1',
        canList: false
      })
    ).toEqual({ ok: false, reason: 'unavailable' })
  })
})

describe('listRemoteDirectory', () => {
  it('maps a directory the way the SFTP browser does and closes the channel', async () => {
    const fake = fakeClient({
      entries: [
        entry('app.log', 'file', '-rw-r--r-- 1 root adm 12 Nov 2 12:00 app.log'),
        entry('nginx', 'dir', 'drwxr-xr-x 2 www-data www-data 4096 Nov 2 12:00 nginx')
      ]
    })
    const result = await listRemoteDirectory(fake.client, '/var/log', () => false)
    expect(result).toEqual({
      ok: true,
      entries: [
        expect.objectContaining({
          name: 'app.log',
          path: '/var/log/app.log',
          type: 'file',
          size: 12,
          permissions: 'rw-r--r--',
          owner: 'root',
          group: 'adm'
        }),
        expect.objectContaining({
          name: 'nginx',
          path: '/var/log/nginx',
          type: 'dir',
          owner: 'www-data'
        })
      ]
    })
    expect(fake.ended()).toBe(1)
    expect(JSON.stringify(result)).not.toContain('permission denied')
  })

  it('returns missing or unavailable without the ssh2 message and still closes SFTP', async () => {
    const missing = fakeClient({ missing: true })
    await expect(listRemoteDirectory(missing.client, '/var/missing', () => false)).resolves.toEqual(
      {
        ok: false,
        reason: 'missing'
      }
    )
    expect(missing.ended()).toBe(1)

    const failed = fakeClient({ fail: true })
    const failure = await listRemoteDirectory(failed.client, '/var', () => false)
    expect(failure).toEqual({ ok: false, reason: 'unavailable' })
    expect(JSON.stringify(failure)).not.toContain('permission denied')
    expect(failed.ended()).toBe(1)
  })

  it('does not open SFTP for an unsafe path, a cancelled session, or a dead channel', async () => {
    const relative = fakeClient({})
    await expect(listRemoteDirectory(relative.client, 'var', () => false)).resolves.toEqual({
      ok: false,
      reason: 'invalid'
    })
    expect(relative.opened()).toBe(0)

    const cancelled = fakeClient({})
    await expect(listRemoteDirectory(cancelled.client, '/var', () => true)).resolves.toEqual({
      ok: false,
      reason: 'unavailable'
    })
    expect(cancelled.opened()).toBe(0)

    const closed = fakeClient({ openError: true })
    await expect(listRemoteDirectory(closed.client, '/var', () => false)).resolves.toEqual({
      ok: false,
      reason: 'unavailable'
    })
    expect(closed.ended()).toBe(0)
  })
})
