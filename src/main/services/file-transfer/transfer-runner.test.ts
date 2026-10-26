import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FileTransferCapability, RemoteEntry } from '@shared/protocols'
import { describe, expect, it, vi } from 'vitest'
import { formatMode } from './local-fs'
import {
  destinationExists,
  planDownload,
  planUpload,
  runTransfer,
  TransferCancelledError
} from './transfer-runner'

function entry(path: string, type: RemoteEntry['type'], size = 0): RemoteEntry {
  return { name: path.split('/').pop() ?? path, path, type, size, modifiedAt: null }
}

function fakeRemote(tree: Record<string, RemoteEntry[]>) {
  return {
    list: vi.fn(async (path: string) => tree[path] ?? []),
    mkdir: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    download: vi.fn(
      async (_r: string, _l: string, onProgress?: (b: number, t: number | null) => void) =>
        onProgress?.(5, 5)
    ),
    upload: vi.fn<FileTransferCapability['upload']>(async () => undefined)
  }
}

describe('transfer-runner', () => {
  it('formats unix modes', () => {
    expect(formatMode(0o100755)).toBe('rwxr-xr-x')
    expect(formatMode(0o640)).toBe('rw-r-----')
  })

  it('plans a recursive remote folder download', async () => {
    const ft = fakeRemote({
      '/app': [entry('/app/a.txt', 'file', 3), entry('/app/sub', 'dir'), entry('/app/..', 'dir')],
      '/app/sub': [entry('/app/sub/b.txt', 'file', 4)]
    })
    const plan = await planDownload(ft, '/app', join('L', 'app'), true)
    expect(plan.dirs).toEqual([join('L', 'app'), join('L', 'app', 'sub')])
    expect(plan.files.map((f) => f.remote)).toEqual(['/app/a.txt', '/app/sub/b.txt'])
  })

  it('plans a recursive local folder upload', async () => {
    const root = await mkdtemp(join(tmpdir(), 'north-ft-'))
    await mkdir(join(root, 'sub'))
    await writeFile(join(root, 'a.txt'), 'abc')
    await writeFile(join(root, 'sub', 'b.txt'), 'abcd')
    const plan = await planUpload(root, '/srv/up')
    expect(plan.dirs).toEqual(['/srv/up', '/srv/up/sub'])
    expect(plan.files.map((f) => [f.remote, f.size]).sort()).toEqual([
      ['/srv/up/a.txt', 3],
      ['/srv/up/sub/b.txt', 4]
    ])
  })

  it('reports aggregate progress and stops between files on cancel', async () => {
    const ft = fakeRemote({})
    const controller = new AbortController()
    const updates: number[] = []
    const plan = {
      dirs: [],
      files: [
        { remote: '/a', local: '/tmp/a', size: 5 },
        { remote: '/b', local: '/tmp/b', size: 5 }
      ]
    }
    await expect(
      runTransfer({
        ft,
        direction: 'download',
        plan,
        signal: controller.signal,
        onProgress: (u) => {
          updates.push(u.bytesTransferred)
          if (u.bytesTransferred === 5) controller.abort()
        }
      })
    ).rejects.toBeInstanceOf(TransferCancelledError)
    expect(ft.download).toHaveBeenCalledTimes(1)
    expect(updates).toEqual([0, 5])
  })

  it('skips files that already exist when asked to', async () => {
    const ft = fakeRemote({})
    const plan = {
      dirs: [],
      files: [
        { remote: '/a', local: '/tmp/a', size: 5 },
        { remote: '/b', local: '/tmp/b', size: 5 }
      ]
    }
    await runTransfer({
      ft,
      direction: 'download',
      plan,
      conflict: 'skip',
      exists: async (file) => file.remote === '/a',
      signal: new AbortController().signal,
      onProgress: () => undefined
    })
    expect(ft.download).toHaveBeenCalledTimes(1)
    expect(ft.download.mock.calls[0][0]).toBe('/b')
  })

  it('aborts the file in flight and removes its partial upload', async () => {
    const controller = new AbortController()
    const ft = fakeRemote({})
    ft.upload.mockImplementation(async () => {
      controller.abort()
      throw new Error('socket closed')
    })
    await expect(
      runTransfer({
        ft,
        direction: 'upload',
        plan: { dirs: [], files: [{ remote: '/srv/big.iso', local: '/tmp/big.iso', size: 9 }] },
        signal: controller.signal,
        onProgress: () => undefined
      })
    ).rejects.toBeInstanceOf(TransferCancelledError)
    expect(ft.upload.mock.calls[0][3]).toBe(controller.signal)
    expect(ft.remove).toHaveBeenCalledWith('/srv/big.iso')
  })

  it('finds existing remote names with one listing per folder', async () => {
    const ft = fakeRemote({ '/srv': [entry('/srv/a.txt', 'file', 1)] })
    const exists = destinationExists(ft, 'upload')
    expect(await exists({ remote: '/srv/a.txt', local: '/x/a.txt', size: 1 })).toBe(true)
    expect(await exists({ remote: '/srv/b.txt', local: '/x/b.txt', size: 1 })).toBe(false)
    expect(ft.list).toHaveBeenCalledTimes(1)
  })
})
