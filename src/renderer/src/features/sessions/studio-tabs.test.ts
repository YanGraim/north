import { describe, expect, it } from 'vitest'
import { emptyQueryTab, emptyTableTab, neighborTabId, resolveOpenTable } from './studio-tabs'

describe('studio tabs', () => {
  it('activates a neighbor when the current tab closes', () => {
    const first = emptyQueryTab(1)
    const table = emptyTableTab('public', 'orders')
    const second = emptyQueryTab(2)
    const tabs = [first, table, second]
    expect(neighborTabId(tabs, table.id, table.id)).toBe(second.id)
    expect(neighborTabId(tabs, second.id, second.id)).toBe(table.id)
    expect(neighborTabId(tabs, first.id, table.id)).toBe(table.id)
  })

  it('opens a new table tab and requests an immediate browse', () => {
    const query = emptyQueryTab(1)
    const resolved = resolveOpenTable([query], 'public', 'orders')
    expect(resolved.tabs).toHaveLength(2)
    expect(resolved.activeId).toBe(resolved.browseTabId)
    const table = resolved.tabs[1]
    expect(table?.kind).toBe('table')
    expect(table && table.kind === 'table' ? table.table : null).toBe('orders')
    expect(resolved.browseTabId).toBe(table?.id)
  })

  it('reloads an existing table tab when result is still null', () => {
    const empty = emptyTableTab('public', 'orders')
    const resolved = resolveOpenTable([empty], 'public', 'orders')
    expect(resolved.tabs).toHaveLength(1)
    expect(resolved.activeId).toBe(empty.id)
    expect(resolved.browseTabId).toBe(empty.id)
  })

  it('only focuses an existing table tab that already has rows', () => {
    const loaded = emptyTableTab('public', 'orders')
    loaded.result = {
      columns: [{ name: 'id' }],
      rows: [{ id: 1 }],
      rowCount: 1,
      affectedRows: null,
      durationMs: 1,
      truncated: false
    }
    const resolved = resolveOpenTable([loaded], 'public', 'orders')
    expect(resolved.activeId).toBe(loaded.id)
    expect(resolved.browseTabId).toBeNull()
  })
})
