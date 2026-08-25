import { describe, expect, it, vi } from 'vitest'
import {
  type FollowTerminal,
  fitFollowing,
  isAtBottom,
  writeFollowing,
  writelnFollowing
} from './follow-output'

function fakeTerm(viewportY: number, baseY: number): FollowTerminal & { scrolled: boolean } {
  const term: FollowTerminal & { scrolled: boolean } = {
    scrolled: false,
    buffer: { active: { viewportY, baseY } },
    write(_data, callback) {
      callback?.()
    },
    writeln(_data, callback) {
      callback?.()
    },
    scrollToBottom() {
      term.scrolled = true
    }
  }
  return term
}

describe('isAtBottom', () => {
  it('is true when the viewport sits on the last row', () => {
    expect(isAtBottom(fakeTerm(12, 12))).toBe(true)
  })

  it('is false when the user scrolled up', () => {
    expect(isAtBottom(fakeTerm(4, 12))).toBe(false)
  })
})

describe('writeFollowing', () => {
  it('scrolls after write when already at the bottom', () => {
    const term = fakeTerm(3, 3)
    writeFollowing(term, new Uint8Array([1]))
    expect(term.scrolled).toBe(true)
  })

  it('does not pull the viewport if the user scrolled up', () => {
    const term = fakeTerm(0, 8)
    writeFollowing(term, 'log')
    expect(term.scrolled).toBe(false)
  })
})

describe('writelnFollowing', () => {
  it('follows error lines only at the bottom', () => {
    const atBottom = fakeTerm(1, 1)
    writelnFollowing(atBottom, 'err')
    expect(atBottom.scrolled).toBe(true)

    const scrolledUp = fakeTerm(0, 2)
    writelnFollowing(scrolledUp, 'err')
    expect(scrolledUp.scrolled).toBe(false)
  })
})

describe('fitFollowing', () => {
  it('refits and stays at the bottom when already there', () => {
    const term = fakeTerm(5, 5)
    const applyResize = vi.fn()
    fitFollowing(term, applyResize)
    expect(applyResize).toHaveBeenCalledOnce()
    expect(term.scrolled).toBe(true)
  })

  it('refits without jumping when scrolled up', () => {
    const term = fakeTerm(1, 9)
    const applyResize = vi.fn()
    fitFollowing(term, applyResize)
    expect(applyResize).toHaveBeenCalledOnce()
    expect(term.scrolled).toBe(false)
  })
})
