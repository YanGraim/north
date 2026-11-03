import { describe, expect, it } from 'vitest'
import { namedPipeAlive, serviceQueryIsRunning } from './windows-vpn-service'

describe('namedPipeAlive', () => {
  it('is up when stat sees the pipe', () => {
    expect(namedPipeAlive('\\\\.\\pipe\\north-vpn', () => {})).toBe(true)
  })

  it('is down only when the pipe is not there', () => {
    const missing = Object.assign(new Error('missing'), { code: 'ENOENT' })
    expect(namedPipeAlive('\\\\.\\pipe\\north-vpn', () => { throw missing })).toBe(false)
  })

  it('treats a busy pipe as up', () => {
    const busy = Object.assign(new Error('busy'), { code: 'EBUSY' })
    expect(namedPipeAlive('\\\\.\\pipe\\north-vpn', () => { throw busy })).toBe(true)
  })
})

describe('serviceQueryIsRunning', () => {
  it('reads English and Portuguese sc query output', () => {
    expect(serviceQueryIsRunning('        STATE              : 4  RUNNING')).toBe(true)
    expect(serviceQueryIsRunning('        ESTADO             : 4  RUNNING')).toBe(true)
    expect(serviceQueryIsRunning('        ESTADO             : 1  STOPPED')).toBe(false)
  })
})
