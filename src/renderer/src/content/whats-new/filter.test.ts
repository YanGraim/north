import { describe, expect, it } from 'vitest'
import { filterWhatsNewEntries } from './filter'

const ENTRIES = [{ version: '0.1.11' }, { version: '0.1.13' }, { version: '0.1.14' }] as const

describe('filterWhatsNewEntries', () => {
  it('returns nothing on first boot (no lastSeen)', () => {
    expect(filterWhatsNewEntries(ENTRIES, null, '0.1.14')).toEqual([])
    expect(filterWhatsNewEntries(ENTRIES, undefined, '0.1.14')).toEqual([])
  })

  it('returns entries strictly after lastSeen up to current', () => {
    expect(filterWhatsNewEntries(ENTRIES, '0.1.12', '0.1.13').map((e) => e.version)).toEqual([
      '0.1.13'
    ])
    expect(filterWhatsNewEntries(ENTRIES, '0.1.11', '0.1.14').map((e) => e.version)).toEqual([
      '0.1.13',
      '0.1.14'
    ])
  })

  it('returns nothing when already on lastSeen', () => {
    expect(filterWhatsNewEntries(ENTRIES, '0.1.13', '0.1.13')).toEqual([])
  })

  it('excludes versions newer than current (partial upgrade edge)', () => {
    expect(filterWhatsNewEntries(ENTRIES, '0.1.12', '0.1.13').map((e) => e.version)).toEqual([
      '0.1.13'
    ])
  })
})
