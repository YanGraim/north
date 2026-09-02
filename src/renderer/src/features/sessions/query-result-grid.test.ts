import { describe, expect, it } from 'vitest'
import {
  appendInsert,
  buildDisplayRows,
  cellSelectionRect,
  collectRectValues,
  collectUpdatePayloads,
  collectVisibleColumnValues,
  compareCell,
  cycleSort,
  duplicateRowValues,
  emptyGridDraft,
  emptyRowForColumns,
  hasDirtyDraft,
  insertDuplicate,
  isCellDirty,
  markRowsDeleted,
  orderedColumnIndices,
  parseCellInput,
  removeInserts,
  reorderList,
  rowsToTsv,
  selectIndexRange,
  selectionToRows,
  selectionToTsv,
  selectRange,
  setCellEdit,
  setInsertCell,
  sortRows,
  sumNumericCells,
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

  it('exports selection rows, columns and cell rectangles', () => {
    const rows = [
      { id: 1, name: 'a', qty: 2 },
      { id: 2, name: 'b', qty: 3 }
    ]
    const resultColumns = [{ name: 'id' }, { name: 'name' }, { name: 'qty' }]
    const rowSelection = selectionToRows({
      mode: 'rows',
      displayRows: rows,
      orderedColumnNames: ['id', 'name', 'qty'],
      selectedRowIndices: new Set([0]),
      selectedColumnNames: [],
      resultColumns
    })
    expect(rowSelection.rows).toEqual([rows[0]])

    const columnSelection = selectionToRows({
      mode: 'columns',
      displayRows: rows,
      orderedColumnNames: ['id', 'name', 'qty'],
      selectedRowIndices: new Set(),
      selectedColumnNames: ['name'],
      resultColumns
    })
    expect(columnSelection.columns.map((column) => column.name)).toEqual(['name'])
    expect(columnSelection.rows).toEqual(rows)

    const cellSelection = selectionToRows({
      mode: 'cells',
      displayRows: rows,
      orderedColumnNames: ['id', 'name', 'qty'],
      selectedRowIndices: new Set([0]),
      selectedColumnNames: ['id', 'qty'],
      resultColumns
    })
    expect(cellSelection.rows).toEqual([{ id: 1, qty: 2 }])
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

  it('displays duplicates immediately below the source row', () => {
    const rows = [
      { id: 1, name: 'ada' },
      { id: 2, name: 'grace' }
    ]
    const indexed = rows.map((row, sourceIndex) => ({ sourceIndex, row }))
    let draft = insertDuplicate(
      emptyGridDraft(),
      { id: null, name: 'ada' },
      { afterSourceIndex: 0 }
    )
    draft = appendInsert(draft, { id: null, name: 'empty' }, null)
    const display = buildDisplayRows(indexed, draft)
    expect(display.map((row) => row.kind)).toEqual(['existing', 'insert', 'existing', 'insert'])
    expect(display[1]).toMatchObject({ kind: 'insert', row: { name: 'ada' } })
    expect(display[3]).toMatchObject({ kind: 'insert', row: { name: 'empty' } })

    const fromInsert = insertDuplicate(
      draft,
      { id: null, name: 'ada-2' },
      {
        afterSourceIndex: 0,
        afterInsertIndex: 0
      }
    )
    const nested = buildDisplayRows(indexed, fromInsert)
    expect(nested.filter((row) => row.kind === 'insert').map((row) => row.row.name)).toEqual([
      'ada',
      'ada-2',
      'empty'
    ])
  })

  it('sets insert cells including NULL', () => {
    let draft = appendInsert(emptyGridDraft(), { id: 1, name: 'x' })
    draft = setInsertCell(draft, 0, 'name', null)
    expect(draft.inserts[0]?.values.name).toBeNull()
  })

  it('parses cell input with null and typed values', () => {
    expect(parseCellInput('NULL', 'x')).toBeNull()
    expect(parseCellInput('42', 1)).toBe(42)
    expect(parseCellInput('true', false)).toBe(true)
  })

  it('selects a visual index range for column Shift+click', () => {
    expect(selectIndexRange([2, 0, 1], 2, 1)).toEqual([2, 0, 1])
    expect(selectIndexRange([2, 0, 1], 0, 0)).toEqual([0])
    expect(selectIndexRange([0, 1, 2], 9, 1)).toEqual([1])
  })

  it('copies TSV for row mode vs column mode', () => {
    const rows = [
      { id: 1, name: 'ada', amount: 10 },
      { id: 2, name: 'grace', amount: 20 }
    ]
    expect(
      selectionToTsv({
        mode: 'rows',
        displayRows: rows,
        orderedColumnNames: ['id', 'name', 'amount'],
        selectedRowIndices: new Set([1]),
        selectedColumnNames: ['amount']
      })
    ).toBe('2\tgrace\t20')
    expect(
      selectionToTsv({
        mode: 'columns',
        displayRows: rows,
        orderedColumnNames: ['id', 'name', 'amount'],
        selectedRowIndices: new Set([0]),
        selectedColumnNames: ['name', 'amount']
      })
    ).toBe('ada\t10\ngrace\t20')
    expect(
      selectionToTsv({
        mode: 'cells',
        displayRows: rows,
        orderedColumnNames: ['id', 'name', 'amount'],
        selectedRowIndices: new Set([0, 1]),
        selectedColumnNames: ['amount']
      })
    ).toBe('10\n20')
  })

  it('builds a cell rectangle for drag up/down in one column', () => {
    expect(
      cellSelectionRect(
        { displayIndex: 4, columnIndex: 2 },
        { displayIndex: 2, columnIndex: 2 },
        [0, 1, 2]
      )
    ).toEqual({ displayIndices: [2, 3, 4], columnIndices: [2] })
    expect(
      collectRectValues(
        [{ amount: 10 }, { amount: 20 }, { amount: 30 }, { amount: 40 }, { amount: 50 }],
        [2, 3, 4],
        ['amount']
      )
    ).toEqual([30, 40, 50])
  })

  it('sums numeric visible cells and skips null/text', () => {
    expect(sumNumericCells([1, 2, null, 'x', 3.5, false])).toBe(6.5)
    expect(sumNumericCells([null, '10', true])).toBe(10)
    expect(sumNumericCells(['175000', '670', '3250', '0', '0', '600.000001'])).toBeCloseTo(
      179520.000001
    )
    expect(sumNumericCells(['  12.5  ', '-0.5'])).toBe(12)
    expect(sumNumericCells(['0x10', 'Infinity', '', '10px'])).toBeNull()
    expect(sumNumericCells([])).toBeNull()
    const edits = setCellEdit({}, 0, 'amount', 10, 4)
    expect(
      collectVisibleColumnValues(
        [
          { id: 1, amount: 10 },
          { id: 2, amount: 20 }
        ],
        ['amount'],
        edits,
        [{ values: { id: null, amount: 1 }, afterSourceIndex: null }]
      )
    ).toEqual([4, 20, 1])
    expect(
      sumNumericCells(
        collectVisibleColumnValues(
          [
            { id: 1, amount: 10 },
            { id: 2, amount: 20 }
          ],
          ['amount'],
          edits,
          [{ values: { id: null, amount: 1 }, afterSourceIndex: null }]
        )
      )
    ).toBe(25)
  })
})
