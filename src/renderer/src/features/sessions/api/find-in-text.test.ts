import { describe, expect, it } from 'vitest'
import { findMatches, stepMatchIndex } from './find-in-text'

describe('findMatches', () => {
  it('returns no matches for an empty query', () => {
    expect(findMatches('hello world', '')).toEqual([])
    expect(findMatches('hello world', '   ')).toEqual([])
  })

  it('finds a single case-insensitive match', () => {
    expect(findMatches('Hello World', 'world')).toEqual([{ from: 6, to: 11 }])
  })

  it('finds every non-overlapping occurrence', () => {
    expect(findMatches('foo foo foo', 'foo')).toEqual([
      { from: 0, to: 3 },
      { from: 4, to: 7 },
      { from: 8, to: 11 }
    ])
  })

  it('does not double-count overlapping occurrences', () => {
    expect(findMatches('aaaa', 'aa')).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 }
    ])
  })

  it('returns no matches when the query is not present', () => {
    expect(findMatches('hello world', 'xyz')).toEqual([])
  })
})

describe('stepMatchIndex', () => {
  it('returns -1 when there are no matches', () => {
    expect(stepMatchIndex(0, -1, 'next')).toBe(-1)
    expect(stepMatchIndex(0, -1, 'prev')).toBe(-1)
  })

  it('starts at the first match going next from -1', () => {
    expect(stepMatchIndex(3, -1, 'next')).toBe(0)
  })

  it('starts at the last match going prev from -1', () => {
    expect(stepMatchIndex(3, -1, 'prev')).toBe(2)
  })

  it('wraps forward past the last match', () => {
    expect(stepMatchIndex(3, 2, 'next')).toBe(0)
  })

  it('wraps backward past the first match', () => {
    expect(stepMatchIndex(3, 0, 'prev')).toBe(2)
  })

  it('steps forward and backward within range', () => {
    expect(stepMatchIndex(3, 0, 'next')).toBe(1)
    expect(stepMatchIndex(3, 1, 'prev')).toBe(0)
  })
})
