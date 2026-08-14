import { describe, expect, it } from 'vitest'
import {
  appendInsert,
  collectUpdatePayloads,
  compareCell,
  cycleSort,
  duplicateRowValues,
  emptyGridDraft,
  emptyRowForColumns,
  hasDirtyDraft,
  isCellDirty,
  markRowsDeleted,
  orderedColumnIndices,
  parseCellInput,
  removeInserts,
  reorderList,
  rowsToTsv,
  selectRange,
  setCellEdit,
  sortRows,
  toggleInSet
} from './query-result-grid'

const columns = [{ name: 'id' }, { name: 'name' }]

describe('query result grid helpers', () => {
  it('sorts numbers, strings and nulls last', () => {
    const rows = [
      { id: 2, name: 'b' },
      { id: null, name: 'z' },
      { id: 1, name: 'a' }
    ]
    expect(sortRows(rows, columns, { columnIndex: 0, dir: 'asc' }).map((row) => row.id)).toEqual([
      1,
      2,
      null
    ])
    expect(sortRows(rows, columns, { columnIndex: 1, dir: 'desc' }).map((row) => row.name)).toEqual(
      ['z', 'b', 'a']
    )
  })

  it('compares mixed cell types without throwing', () => {
    expect(compareCell(true, false)).toBeGreaterThan(0)
    expect(compareCell('10', '2')).toBeGreaterThan(0)
  })

  it('reorders columns and cycles sort', () => {
    expect(reorderList(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(cycleSort(null, 1)).toEqual({ columnIndex: 1, dir: 'asc' })
    expect(cycleSort({ columnIndex: 1, dir: 'asc' }, 1)).toEqual({ columnIndex: 1, dir: 'desc' })
    expect(cycleSort({ columnIndex: 1, dir: 'desc' }, 1)).toBeNull()
  })

  it('repairs a stale column order', () => {
    expect(orderedColumnIndices(3, [2, 0])).toEqual([2, 0, 1])
    expect(orderedColumnIndices(2, [0, 1, 9])).toEqual([0, 1])
  })

  it('builds TSV for selected rows in column order', () => {
    const rows = [
      { id: 1, name: 'ada' },
      { id: 2, name: 'grace' }
    ]
    expect(rowsToTsv(rows, ['name', 'id'])).toBe('ada\t1\ngrace\t2')
    expect(rowsToTsv([{ id: 1, name: 'a\tb' }], ['name'])).toBe('"a\tb"')
  })

  it('toggles and ranges row selection', () => {
    expect([...toggleInSet(new Set([1]), 1)]).toEqual([])
    expect([...toggleInSet(new Set([1]), 2)].sort()).toEqual([1, 2])
    expect(selectRange(3, 1)).toEqual([1, 2, 3])
  })

  it('tracks dirty cell edits and update payloads', () => {
    let edits = setCellEdit({}, 0, 'name', 'ada', 'Ada')
    edits = setCellEdit(edits, 0, 'name', 'ada', 'ada')
    expect(edits).toEqual({})
    edits = setCellEdit({}, 1, 'name', 'grace', 'Grace')
    expect(hasDirtyDraft({ edits, inserts: [], deletes: [] })).toBe(true)
    expect(
      collectUpdatePayloads(edits, [
        { id: 1, name: 'ada' },
        { id: 2, name: 'grace' }
      ])
    ).toEqual([
      {
        sourceIndex: 1,
        original: { id: 2, name: 'grace' },
        changes: { name: 'Grace' }
      }
    ])
  })

  it('marks draft dirty as soon as a live cell value differs from original', () => {
    const draft = emptyGridDraft()
    const live = {
      ...draft,
      edits: setCellEdit(draft.edits, 0, 'amount', 26, 4)
    }
    expect(hasDirtyDraft(live)).toBe(true)
    expect(isCellDirty(live.edits, 0, 'amount')).toBe(true)
    const reverted = {
      ...live,
      edits: setCellEdit(live.edits, 0, 'amount', 26, 26)
    }
    expect(hasDirtyDraft(reverted)).toBe(false)
  })

  it('skips deleted rows when collecting update payloads', () => {
    const edits = setCellEdit({}, 0, 'name', 'ada', 'Ada')
    expect(collectUpdatePayloads(edits, [{ id: 1, name: 'ada' }], [0])).toEqual([])
  })

  it('builds draft inserts, duplicates and delete marks', () => {
    const empty = emptyRowForColumns(['id', 'name'])
    expect(empty).toEqual({ id: null, name: null })
    expect(duplicateRowValues({ id: 1, name: 'ada' }, ['id', 'name'], ['id'])).toEqual({
      id: null,
      name: 'ada'
    })
    let draft = appendInsert(emptyGridDraft(), empty)
    draft = markRowsDeleted(draft, [0, 2])
    expect(hasDirtyDraft(draft)).toBe(true)
    expect(draft.deletes).toEqual([0, 2])
    draft = removeInserts(draft, [0])
    expect(draft.inserts).toEqual([])
  })

  it('parses cell input with null and typed values', () => {
    expect(parseCellInput('NULL', 'x')).toBeNull()
    expect(parseCellInput('42', 1)).toBe(42)
    expect(parseCellInput('true', false)).toBe(true)
  })
})
