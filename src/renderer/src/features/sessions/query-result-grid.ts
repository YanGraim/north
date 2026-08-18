import type { DatabaseCellValue, DatabaseQueryColumn } from '@shared/protocols'

export type GridSortDir = 'asc' | 'desc'

export type GridSort = {
  columnIndex: number
  dir: GridSortDir
} | null

/** Source-row index → column name → edited value */
export type GridEdits = Record<number, Record<string, DatabaseCellValue>>

/** Pending mutations for a table-tab grid (cell edits, inserts, deletes). */
export type GridDraft = {
  edits: GridEdits
  inserts: Array<Record<string, DatabaseCellValue>>
  /** Source indices of loaded rows marked for DELETE on save. */
  deletes: number[]
}

export function emptyGridDraft(): GridDraft {
  return { edits: {}, inserts: [], deletes: [] }
}

export type SortedGridRow<T extends Record<string, DatabaseCellValue>> = {
  sourceIndex: number
  row: T
}

/** Display row: existing result row or a local insert pending save. */
export type DraftDisplayRow<T extends Record<string, DatabaseCellValue>> =
  | { kind: 'existing'; sourceIndex: number; row: T; markedDelete: boolean }
  | { kind: 'insert'; insertIndex: number; row: T }

export function compareCell(
  a: DatabaseCellValue | undefined,
  b: DatabaseCellValue | undefined
): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function sortRows<T extends Record<string, DatabaseCellValue>>(
  rows: T[],
  columns: DatabaseQueryColumn[],
  sort: GridSort
): T[] {
  return sortRowsWithIndex(rows, columns, sort).map((entry) => entry.row)
}

export function sortRowsWithIndex<T extends Record<string, DatabaseCellValue>>(
  rows: T[],
  columns: DatabaseQueryColumn[],
  sort: GridSort
): SortedGridRow<T>[] {
  const indexed = rows.map((row, sourceIndex) => ({ sourceIndex, row }))
  if (!sort) return indexed
  const column = columns[sort.columnIndex]
  if (!column) return indexed
  indexed.sort((left, right) => {
    const cmp = compareCell(left.row[column.name], right.row[column.name])
    return sort.dir === 'asc' ? cmp : -cmp
  })
  return indexed
}

export function reorderList<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  if (moved === undefined) return items
  next.splice(toIndex, 0, moved)
  return next
}

export function cycleSort(current: GridSort, columnIndex: number): GridSort {
  if (current?.columnIndex !== columnIndex) return { columnIndex, dir: 'asc' }
  if (current.dir === 'asc') return { columnIndex, dir: 'desc' }
  return null
}

export function orderedColumnIndices(columnCount: number, order: number[]): number[] {
  const seen = new Set<number>()
  const next: number[] = []
  for (const index of order) {
    if (index < 0 || index >= columnCount || seen.has(index)) continue
    seen.add(index)
    next.push(index)
  }
  for (let index = 0; index < columnCount; index++) {
    if (!seen.has(index)) next.push(index)
  }
  return next
}

export function selectRange(from: number, to: number): number[] {
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  const next: number[] = []
  for (let index = start; index <= end; index++) next.push(index)
  return next
}

export function toggleInSet(selected: ReadonlySet<number>, index: number): Set<number> {
  const next = new Set(selected)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  return next
}

/** Inclusive range along a visual order (column header Shift+click). */
export function selectIndexRange(
  ordered: readonly number[],
  fromId: number,
  toId: number
): number[] {
  const fromPos = ordered.indexOf(fromId)
  const toPos = ordered.indexOf(toId)
  if (fromPos < 0 || toPos < 0) return [toId]
  const start = Math.min(fromPos, toPos)
  const end = Math.max(fromPos, toPos)
  return ordered.slice(start, end + 1)
}

export type CellPos = {
  displayIndex: number
  columnIndex: number
}

/** Inclusive rectangle between two cells (display rows × visual column order). */
export function cellSelectionRect(
  anchor: CellPos,
  focus: CellPos,
  orderedColumnIndices: readonly number[]
): { displayIndices: number[]; columnIndices: number[] } {
  return {
    displayIndices: selectRange(anchor.displayIndex, focus.displayIndex),
    columnIndices: selectIndexRange(orderedColumnIndices, anchor.columnIndex, focus.columnIndex)
  }
}

export function isCellInRect(
  displayIndex: number,
  columnIndex: number,
  rect: { displayIndices: readonly number[]; columnIndices: readonly number[] }
): boolean {
  return rect.displayIndices.includes(displayIndex) && rect.columnIndices.includes(columnIndex)
}

export function formatTsvCell(value: DatabaseCellValue | undefined): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  if (/[\t\n\r"]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function rowsToTsv(
  rows: Array<Record<string, DatabaseCellValue>>,
  columnNames: readonly string[]
): string {
  return rows
    .map((row) => columnNames.map((name) => formatTsvCell(row[name])).join('\t'))
    .join('\n')
}

export function selectionToTsv(input: {
  mode: 'rows' | 'columns' | 'cells'
  displayRows: Array<Record<string, DatabaseCellValue>>
  orderedColumnNames: readonly string[]
  selectedRowIndices: ReadonlySet<number>
  selectedColumnNames: readonly string[]
}): string {
  if (input.mode === 'columns') {
    return rowsToTsv(input.displayRows, input.selectedColumnNames)
  }
  const rows = input.displayRows.filter((_, index) => input.selectedRowIndices.has(index))
  const columns = input.mode === 'cells' ? input.selectedColumnNames : input.orderedColumnNames
  return rowsToTsv(rows, columns)
}

export function collectRectValues(
  displayRows: Array<Record<string, DatabaseCellValue>>,
  displayIndices: readonly number[],
  columnNames: readonly string[]
): DatabaseCellValue[] {
  const values: DatabaseCellValue[] = []
  for (const rowIndex of displayIndices) {
    const row = displayRows[rowIndex]
    if (!row) continue
    for (const name of columnNames) {
      values.push(row[name] ?? null)
    }
  }
  return values
}

export function collectVisibleColumnValues(
  rows: Array<Record<string, DatabaseCellValue>>,
  columnNames: readonly string[],
  edits: GridEdits | undefined,
  inserts: ReadonlyArray<Record<string, DatabaseCellValue>> = []
): DatabaseCellValue[] {
  const values: DatabaseCellValue[] = []
  rows.forEach((row, sourceIndex) => {
    for (const name of columnNames) {
      values.push(cellDisplayValue(row, name, edits, sourceIndex) ?? null)
    }
  })
  for (const row of inserts) {
    for (const name of columnNames) {
      values.push(row[name] ?? null)
    }
  }
  return values
}

/** DECIMAL / NUMERIC / BIGINT arrive as strings from the driver (see serializeCell). */
const NUMERIC_STRING = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

function asFiniteNumber(value: DatabaseCellValue): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!NUMERIC_STRING.test(trimmed)) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

export function sumNumericCells(values: readonly DatabaseCellValue[]): number | null {
  let total = 0
  let any = false
  for (const value of values) {
    const num = asFiniteNumber(value)
    if (num === null) continue
    total += num
    any = true
  }
  return any ? total : null
}

export function cellDisplayValue(
  row: Record<string, DatabaseCellValue>,
  column: string,
  edits: GridEdits | undefined,
  sourceIndex: number
): DatabaseCellValue | undefined {
  const edited = edits?.[sourceIndex]?.[column]
  if (edited !== undefined) return edited
  return row[column]
}

export function isCellDirty(
  edits: GridEdits | undefined,
  sourceIndex: number,
  column: string
): boolean {
  return edits?.[sourceIndex]?.[column] !== undefined
}

export function hasDirtyEdits(edits: GridEdits | undefined): boolean {
  if (!edits) return false
  return Object.values(edits).some((columns) => Object.keys(columns).length > 0)
}

export function hasDirtyDraft(draft: GridDraft | undefined): boolean {
  if (!draft) return false
  return hasDirtyEdits(draft.edits) || draft.inserts.length > 0 || draft.deletes.length > 0
}

export function isRowMarkedDelete(draft: GridDraft | undefined, sourceIndex: number): boolean {
  return draft?.deletes.includes(sourceIndex) ?? false
}

export function setCellEdit(
  edits: GridEdits,
  sourceIndex: number,
  column: string,
  original: DatabaseCellValue | undefined,
  nextValue: DatabaseCellValue
): GridEdits {
  const previous = edits[sourceIndex] ?? {}
  const baseline: DatabaseCellValue = original === undefined ? null : original
  if (baseline === nextValue) {
    const { [column]: _removed, ...rest } = previous
    if (Object.keys(rest).length === 0) {
      const { [sourceIndex]: _row, ...otherRows } = edits
      return otherRows
    }
    return { ...edits, [sourceIndex]: rest }
  }
  return {
    ...edits,
    [sourceIndex]: { ...previous, [column]: nextValue }
  }
}

export function parseCellInput(
  raw: string,
  previous: DatabaseCellValue | undefined
): DatabaseCellValue {
  const trimmed = raw.trim()
  if (trimmed.toUpperCase() === 'NULL' || (trimmed === '' && previous === null)) return null
  if (typeof previous === 'number') {
    const num = Number(trimmed)
    if (trimmed !== '' && Number.isFinite(num)) return num
  }
  if (typeof previous === 'boolean') {
    const lower = trimmed.toLowerCase()
    if (lower === 'true' || lower === '1') return true
    if (lower === 'false' || lower === '0') return false
  }
  return raw
}

export function collectUpdatePayloads(
  edits: GridEdits,
  rows: Array<Record<string, DatabaseCellValue>>,
  deletedSourceIndices: ReadonlySet<number> | readonly number[] = []
): Array<{
  sourceIndex: number
  original: Record<string, DatabaseCellValue>
  changes: Record<string, DatabaseCellValue>
}> {
  const deleted =
    deletedSourceIndices instanceof Set ? deletedSourceIndices : new Set(deletedSourceIndices)
  const payloads: Array<{
    sourceIndex: number
    original: Record<string, DatabaseCellValue>
    changes: Record<string, DatabaseCellValue>
  }> = []
  for (const [indexText, changes] of Object.entries(edits)) {
    const sourceIndex = Number(indexText)
    if (deleted.has(sourceIndex)) continue
    const original = rows[sourceIndex]
    if (!original || Object.keys(changes).length === 0) continue
    payloads.push({ sourceIndex, original, changes })
  }
  return payloads
}

export function emptyRowForColumns(
  columnNames: readonly string[]
): Record<string, DatabaseCellValue> {
  const row: Record<string, DatabaseCellValue> = {}
  for (const name of columnNames) row[name] = null
  return row
}

/** Duplicate a row and clear primary-key columns so serial/identity can assign. */
export function duplicateRowValues(
  row: Record<string, DatabaseCellValue>,
  columnNames: readonly string[],
  pkColumns: readonly string[]
): Record<string, DatabaseCellValue> {
  const next = emptyRowForColumns(columnNames)
  const pk = new Set(pkColumns)
  for (const name of columnNames) {
    next[name] = pk.has(name) ? null : (row[name] ?? null)
  }
  return next
}

export function markRowsDeleted(draft: GridDraft, sourceIndices: readonly number[]): GridDraft {
  const deletes = new Set(draft.deletes)
  for (const index of sourceIndices) {
    if (index >= 0) deletes.add(index)
  }
  const edits = { ...draft.edits }
  for (const index of sourceIndices) {
    delete edits[index]
  }
  return { ...draft, edits, deletes: [...deletes].sort((a, b) => a - b) }
}

export function removeInserts(draft: GridDraft, insertIndices: readonly number[]): GridDraft {
  if (insertIndices.length === 0) return draft
  const drop = new Set(insertIndices)
  return {
    ...draft,
    inserts: draft.inserts.filter((_, index) => !drop.has(index))
  }
}

export function setInsertCell(
  draft: GridDraft,
  insertIndex: number,
  column: string,
  value: DatabaseCellValue
): GridDraft {
  const inserts = draft.inserts.map((row, index) =>
    index === insertIndex ? { ...row, [column]: value } : row
  )
  return { ...draft, inserts }
}

export function appendInsert(draft: GridDraft, row: Record<string, DatabaseCellValue>): GridDraft {
  return { ...draft, inserts: [...draft.inserts, row] }
}

export function buildDisplayRows<T extends Record<string, DatabaseCellValue>>(
  rows: T[],
  draft: GridDraft | undefined
): DraftDisplayRow<T>[] {
  const deleted = new Set(draft?.deletes ?? [])
  const existing: DraftDisplayRow<T>[] = rows.map((row, sourceIndex) => ({
    kind: 'existing',
    sourceIndex,
    row,
    markedDelete: deleted.has(sourceIndex)
  }))
  const inserts: DraftDisplayRow<T>[] = (draft?.inserts ?? []).map((row, insertIndex) => ({
    kind: 'insert',
    insertIndex,
    row: row as T
  }))
  return [...existing, ...inserts]
}
