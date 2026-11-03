import { describe, expect, it } from 'vitest'
import { nextOsc7Cwd, parseOsc7Cwd } from './osc7-cwd'

describe('parseOsc7Cwd', () => {
  it('ignores the host', () => {
    expect(parseOsc7Cwd('file://alpha.example/var/log')).toBe('/var/log')
    expect(parseOsc7Cwd('file://beta/var/log')).toBe('/var/log')
    expect(parseOsc7Cwd('file:///var/log')).toBe('/var/log')
    expect(parseOsc7Cwd('file://[::1]/var/log')).toBe('/var/log')
  })

  it('percent-decodes %20 and %2F', () => {
    expect(parseOsc7Cwd('file://host/my%20dir')).toBe('/my dir')
    expect(parseOsc7Cwd('file://host/foo%2Fbar')).toBe('/foo/bar')
  })

  it('rejects a relative path', () => {
    expect(parseOsc7Cwd('var/log')).toBeNull()
    expect(parseOsc7Cwd('./etc')).toBeNull()
    expect(parseOsc7Cwd('file:var/log')).toBeNull()
    expect(parseOsc7Cwd('../etc')).toBeNull()
  })

  it('rejects a scheme that is not file', () => {
    expect(parseOsc7Cwd('http://host/var/log')).toBeNull()
    expect(parseOsc7Cwd('ssh://host/var/log')).toBeNull()
    expect(parseOsc7Cwd('ftp://host/var')).toBeNull()
  })

  it('does not turn an empty path into /', () => {
    expect(parseOsc7Cwd('')).toBeNull()
    expect(parseOsc7Cwd('file://')).toBeNull()
    expect(parseOsc7Cwd('file://hostname')).toBeNull()
    expect(parseOsc7Cwd('file://hostname')).not.toBe('/')
  })

  it('accepts an explicit root and drops a trailing slash', () => {
    expect(parseOsc7Cwd('file://hostname/')).toBe('/')
    expect(parseOsc7Cwd('file:///')).toBe('/')
    expect(parseOsc7Cwd('file://host/var/log/')).toBe('/var/log')
  })

  it('rejects a broken percent-escape and a control character', () => {
    expect(parseOsc7Cwd('file://host/a%2')).toBeNull()
    expect(parseOsc7Cwd('file://host/a%zz')).toBeNull()
    expect(parseOsc7Cwd('file://host/var/%0Aetc')).toBeNull()
  })
})

describe('nextOsc7Cwd', () => {
  it('keeps the current path when the payload is the same directory', () => {
    const current = '/var'
    expect(nextOsc7Cwd(current, 'file://host/var')).toBe(current)
    expect(nextOsc7Cwd(current, 'file://other/var/')).toBe(current)
  })

  it('replaces the path when OSC 7 names another directory', () => {
    expect(nextOsc7Cwd('/var', 'file://host/var/log')).toBe('/var/log')
  })

  it('keeps the current path when the payload is not a cwd', () => {
    const current = '/var'
    expect(nextOsc7Cwd(current, 'http://host/tmp')).toBe(current)
    expect(nextOsc7Cwd(current, 'file://host')).toBe(current)
    expect(nextOsc7Cwd(null, 'file://host')).toBeNull()
  })
})
