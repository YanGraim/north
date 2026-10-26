import { describe, expect, it } from 'vitest'
import { formatSize, isRootPath, joinPath, parentPath } from './paths'

describe('file-browser paths', () => {
  it('joins posix and windows paths', () => {
    expect(joinPath('/', 'etc', '/')).toBe('/etc')
    expect(joinPath('/var/www', 'html', '/')).toBe('/var/www/html')
    expect(joinPath('C:\\', 'Users', '\\')).toBe('C:\\Users')
    expect(joinPath('C:\\Users', 'yan', '\\')).toBe('C:\\Users\\yan')
  })

  it('walks up to the root and stops there', () => {
    expect(parentPath('/var/www', '/')).toBe('/var')
    expect(parentPath('/var', '/')).toBe('/')
    expect(parentPath('/', '/')).toBe('/')
    expect(parentPath('C:\\Users\\yan', '\\')).toBe('C:\\Users')
    expect(parentPath('C:\\Users', '\\')).toBe('C:\\')
    expect(parentPath('C:\\', '\\')).toBe('C:\\')
    expect(isRootPath('D:\\', '\\')).toBe(true)
  })

  it('formats sizes', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2.0 KB')
  })
})
