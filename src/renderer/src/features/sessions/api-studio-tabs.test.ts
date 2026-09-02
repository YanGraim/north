import { describe, expect, it } from 'vitest'
import { emptyScratchTab, neighborTabId } from './api-studio-tabs'

describe('api studio tabs', () => {
  it('creates a GET scratch tab', () => {
    const tab = emptyScratchTab('Nova request')
    expect(tab.method).toBe('GET')
    expect(tab.url).toBe('')
    expect(tab.requestId).toBeNull()
    expect(tab.definition.body.type).toBe('none')
    expect(tab.dirty).toBe(false)
  })

  it('activates a neighbor when the current tab closes', () => {
    const first = emptyScratchTab('A')
    const second = emptyScratchTab('B')
    const third = emptyScratchTab('C')
    const tabs = [first, second, third]
    expect(neighborTabId(tabs, second.id, second.id)).toBe(third.id)
    expect(neighborTabId(tabs, third.id, third.id)).toBe(second.id)
    expect(neighborTabId(tabs, first.id, second.id)).toBe(second.id)
  })
})
