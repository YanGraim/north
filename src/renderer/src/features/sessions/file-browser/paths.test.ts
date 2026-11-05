import { describe, expect, it } from 'vitest'
import { formatSize, isRootPath, joinPath, parentPath, pathSegments } from './paths'

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

  it('splits a posix path into clickable prefixes', () => {
    expect(pathSegments('/var/www/html', '/')).toEqual([
      { label: '/', path: '/' },
      { label: 'var', path: '/var' },
      { label: 'www', path: '/var/www' },
      { label: 'html', path: '/var/www/html' }
    ])
    expect(pathSegments('/', '/')).toEqual([{ label: '/', path: '/' }])
    expect(pathSegments('/var/www/', '/')).toEqual([
      { label: '/', path: '/' },
      { label: 'var', path: '/var' },
      { label: 'www', path: '/var/www' }
    ])
    expect(pathSegments('/var//www', '/')).toEqual([
      { label: '/', path: '/' },
      { label: 'var', path: '/var' },
      { label: 'www', path: '/var/www' }
    ])
  })

  it('splits a windows path and keeps the drive root', () => {
    expect(pathSegments('C:\\Users\\yan', '\\')).toEqual([
      { label: 'C:\\', path: 'C:\\' },
      { label: 'Users', path: 'C:\\Users' },
      { label: 'yan', path: 'C:\\Users\\yan' }
    ])
    expect(pathSegments('C:\\', '\\')).toEqual([{ label: 'C:\\', path: 'C:\\' }])
    expect(pathSegments('C:', '\\')).toEqual([{ label: 'C:\\', path: 'C:\\' }])
    expect(pathSegments('D:\\', '\\')).toEqual([{ label: 'D:\\', path: 'D:\\' }])
    expect(pathSegments('C:\\Users\\yan\\', '\\')).toEqual([
      { label: 'C:\\', path: 'C:\\' },
      { label: 'Users', path: 'C:\\Users' },
      { label: 'yan', path: 'C:\\Users\\yan' }
    ])
    expect(pathSegments('\\\\server\\share', '\\')).toEqual([
      { label: '\\\\server\\share', path: '\\\\server\\share' }
    ])
  })

  it('formats sizes', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2.0 KB')
  })
})
