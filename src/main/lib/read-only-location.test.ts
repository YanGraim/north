import { describe, expect, it } from 'vitest'
import { isRunningFromReadOnlyLocation } from './read-only-location'

describe('isRunningFromReadOnlyLocation', () => {
  it('detects a mounted DMG volume on macOS', () => {
    expect(
      isRunningFromReadOnlyLocation(
        'darwin',
        '/Volumes/North 0.1.56/North.app/Contents/MacOS/North'
      )
    ).toBe(true)
  })

  it('detects AppTranslocation on macOS', () => {
    expect(
      isRunningFromReadOnlyLocation(
        'darwin',
        '/private/var/folders/ab/cd1234/AppTranslocation/6F1E2D3C-0000-4000-8000-ABCDEF012345/d/North.app/Contents/MacOS/North'
      )
    ).toBe(true)
  })

  it('does not flag the Applications folder or a user folder on macOS', () => {
    expect(
      isRunningFromReadOnlyLocation('darwin', '/Applications/North.app/Contents/MacOS/North')
    ).toBe(false)
    expect(
      isRunningFromReadOnlyLocation(
        'darwin',
        '/Users/me/Applications/North.app/Contents/MacOS/North'
      )
    ).toBe(false)
  })

  it('is always false on other platforms', () => {
    expect(isRunningFromReadOnlyLocation('linux', '/Volumes/North/North')).toBe(false)
    expect(isRunningFromReadOnlyLocation('win32', 'C:\\AppTranslocation\\North.exe')).toBe(false)
    expect(isRunningFromReadOnlyLocation('linux', '/tmp/AppTranslocation/x/North')).toBe(false)
  })
})
