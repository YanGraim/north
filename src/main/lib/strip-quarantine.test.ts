import { dirname } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { stripQuarantine } from './strip-quarantine'

describe('stripQuarantine', () => {
  it('is a no-op outside darwin', async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })

    await stripQuarantine('/tmp/update.zip', {
      platform: 'linux',
      execFile
    })

    expect(execFile).not.toHaveBeenCalled()
  })

  it('runs xattr -cr on the artifact and its parent on darwin', async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    const target = '/Users/me/Library/Caches/north-updater/pending/North-0.1.16-mac.zip'

    await stripQuarantine(target, {
      platform: 'darwin',
      execFile
    })

    expect(execFile).toHaveBeenCalledTimes(2)
    expect(execFile).toHaveBeenNthCalledWith(1, 'xattr', ['-cr', target])
    expect(execFile).toHaveBeenNthCalledWith(2, 'xattr', ['-cr', dirname(target)])
  })

  it('continues when xattr fails', async () => {
    const execFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('xattr failed'))
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const target = '/tmp/cache/update.zip'

    await expect(
      stripQuarantine(target, {
        platform: 'darwin',
        execFile
      })
    ).resolves.toBeUndefined()

    expect(execFile).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
