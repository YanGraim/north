import { isNewerVersion } from '@shared/lib/semver'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('isNewerVersion', () => {
  it('returns true only when remote is greater', () => {
    expect(isNewerVersion('0.1.3', '0.1.2')).toBe(true)
    expect(isNewerVersion('0.2.0', '0.1.9')).toBe(true)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
  })

  it('returns false for equal or older remote versions', () => {
    expect(isNewerVersion('0.1.2', '0.1.3')).toBe(false)
    expect(isNewerVersion('0.1.3', '0.1.3')).toBe(false)
    expect(isNewerVersion('0.1.0', '0.1.3')).toBe(false)
  })

  it('tolerates a leading v', () => {
    expect(isNewerVersion('v0.1.4', '0.1.3')).toBe(true)
    expect(isNewerVersion('0.1.3', 'v0.1.3')).toBe(false)
  })
})

type CheckResult = { updateInfo: { version: string } } | null

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Loads a fresh `updates.ts` with `electron` and `electron-updater` mocked. */
async function loadUpdates() {
  vi.resetModules()
  const handlers = new Map<string, () => Promise<unknown>>()
  const checkForUpdates = vi.fn<() => Promise<CheckResult>>(async () => null)
  const autoUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    checkForUpdates,
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn()
  }
  vi.doMock('electron', () => ({
    app: { isPackaged: true, getVersion: () => '0.1.0' },
    BrowserWindow: { getAllWindows: () => [] },
    ipcMain: { handle: (channel: string, fn: () => Promise<unknown>) => handlers.set(channel, fn) }
  }))
  vi.doMock('electron-updater', () => ({ autoUpdater }))
  vi.doMock('../app-quit', () => ({ markQuitting: vi.fn() }))
  vi.doMock('../lib/strip-quarantine', () => ({ stripQuarantine: vi.fn(async () => undefined) }))
  const { IpcChannels } = await import('@shared/ipc')
  const { registerUpdateHandlers } = await import('./updates')
  registerUpdateHandlers()
  const check = handlers.get(IpcChannels.UPDATES_CHECK)
  if (!check) throw new Error('UPDATES_CHECK handler not registered')
  return { check, checkForUpdates }
}

describe('runCheck (UPDATES_CHECK)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.doUnmock('electron')
    vi.doUnmock('electron-updater')
    vi.doUnmock('../app-quit')
    vi.doUnmock('../lib/strip-quarantine')
  })

  it('shares the in-flight check: 2 concurrent calls run checkForUpdates once with the same status', async () => {
    const { check, checkForUpdates } = await loadUpdates()
    const pending = deferred<CheckResult>()
    checkForUpdates.mockReturnValueOnce(pending.promise)

    const first = check()
    const second = check()
    pending.resolve({ updateInfo: { version: '0.2.0' } })
    const [a, b] = await Promise.all([first, second])

    expect(checkForUpdates).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
    expect(a).toMatchObject({ available: true, version: '0.2.0', checking: false })
  })

  it('checks again after a finished check', async () => {
    const { check, checkForUpdates } = await loadUpdates()
    await check()
    await check()
    expect(checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('checks again after a failed check', async () => {
    const { check, checkForUpdates } = await loadUpdates()
    checkForUpdates.mockRejectedValueOnce(new Error('network down'))
    const failed = (await check()) as { error: string | null }
    expect(failed.error).toBeTruthy()

    await check()
    expect(checkForUpdates).toHaveBeenCalledTimes(2)
  })
})
