import { describe, expect, it } from 'vitest'
import { isNearBottom, stickToBottom } from './follow-scroll'

function metrics(partial: { scrollTop: number; clientHeight: number; scrollHeight: number }): {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
} {
  return partial
}

describe('isNearBottom', () => {
  it('is true when flush with the bottom', () => {
    expect(isNearBottom(metrics({ scrollTop: 100, clientHeight: 50, scrollHeight: 150 }))).toBe(
      true
    )
  })

  it('is true at the 48px threshold', () => {
    expect(isNearBottom(metrics({ scrollTop: 2, clientHeight: 50, scrollHeight: 100 }))).toBe(true)
  })

  it('is false when more than 48px from the bottom', () => {
    expect(isNearBottom(metrics({ scrollTop: 1, clientHeight: 50, scrollHeight: 100 }))).toBe(false)
  })

  it('accepts a custom threshold', () => {
    expect(isNearBottom(metrics({ scrollTop: 0, clientHeight: 50, scrollHeight: 100 }), 50)).toBe(
      true
    )
    expect(isNearBottom(metrics({ scrollTop: 0, clientHeight: 50, scrollHeight: 100 }), 49)).toBe(
      false
    )
  })
})

describe('stickToBottom', () => {
  it('sets scrollTop to scrollHeight', () => {
    const el = metrics({ scrollTop: 0, clientHeight: 50, scrollHeight: 200 })
    stickToBottom(el)
    expect(el.scrollTop).toBe(200)
  })
})
