import { describe, expect, it } from 'vitest'
import { formatDuration } from './format-duration'

describe('formatDuration', () => {
  it('shows milliseconds under 1s', () => {
    expect(formatDuration(0)).toBe('0 ms')
    expect(formatDuration(512)).toBe('512 ms')
    expect(formatDuration(999)).toBe('999 ms')
  })

  it('shows whole seconds under 1 minute', () => {
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(51_000)).toBe('51s')
    expect(formatDuration(59_400)).toBe('59s')
  })

  it('shows minutes and seconds from 1 minute up', () => {
    expect(formatDuration(60_000)).toBe('1m 0s')
    expect(formatDuration(252_000)).toBe('4m 12s')
  })
})
