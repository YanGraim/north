import { describe, expect, it } from 'vitest'
import { countItemsByGroup } from './count-items-by-group'

describe('countItemsByGroup', () => {
  it('sums connections and accesses per group', () => {
    const counts = countItemsByGroup(
      [{ groupId: 'g1' }, { groupId: 'g1' }, { groupId: 'g2' }],
      [{ groupId: 'g1' }, { groupId: 'g3' }]
    )
    expect(counts.get('g1')).toBe(3)
    expect(counts.get('g2')).toBe(1)
    expect(counts.get('g3')).toBe(1)
    expect(counts.get('missing')).toBeUndefined()
  })

  it('returns empty map when both lists are empty', () => {
    expect(countItemsByGroup([], []).size).toBe(0)
  })
})
