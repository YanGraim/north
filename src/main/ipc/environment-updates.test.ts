import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: {}, dialog: {}, ipcMain: { handle: vi.fn() } }))

const { parseReleaseNotesPng, sanitizeFileName } = await import('./environment-updates')

describe('release notes image', () => {
  it('accepts only PNG bytes', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
    expect(parseReleaseNotesPng(png)).toBe(png)
    expect(() => parseReleaseNotesPng(new Uint8Array([1, 2, 3]))).toThrow('PNG')
    expect(() => parseReleaseNotesPng('x')).toThrow()
  })

  it('cleans the suggested file name', () => {
    expect(sanitizeFileName('WMS v3.5/040: notas')).toBe('WMS v3.5-040- notas')
  })
})
