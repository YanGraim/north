import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  appendInsert,
  type CellPos,
  cellDisplayValue,
  cellSelectionRect,
  collectRectValues,
  cycleSort,
  duplicateRowValues,
  emptyRowForColumns,
  type GridDraft,
  type GridSort,
  hasDirtyDraft,
  isCellDirty,
  isCellInRect,
  markRowsDeleted,
  orderedColumnIndices,
  parseCellInput,
  removeInserts,
  reorderList,
  selectIndexRange,
  selectionToTsv,
  selectRange,
  setCellEdit,
  setInsertCell,
  sortRowsWithIndex,
  toggleInSet
} from '@renderer/features/sessions/query-result-grid'
import { cn } from '@renderer/lib/utils'
import type { DatabaseCellValue, DatabaseQueryResult } from '@shared/protocols'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type QueryResultGridProps = {
  result: DatabaseQueryResult
  /** Allow cell edit / row mutations (table tab, not view). */
  editable?: boolean
  /** PK required to persist deletes/updates; inserts still allowed locally. */
  canPersist?: boolean
  draft?: GridDraft
  onDraftChange?: (draft: GridDraft) => void
  pkColumns?: readonly string[]
  /** First selected existing-row source index (ignores inserts). */
  onActiveSourceIndexChange?: (sourceIndex: number | null) => void
  /** Show insert/duplicate/delete context menu (table tabs only). */
  rowActions?: boolean
  /** Fired when the user scrolls near the bottom (table browse pagination). */
  onNearEnd?: () => void
  /** Visible values in the current column/cell selection (for footer Sum). */
  onSumSelectionChange?: (values: DatabaseCellValue[]) => void
}

type EditingCell =
  | { kind: 'existing'; sourceIndex: number; column: string }
  | { kind: 'insert'; insertIndex: number; column: string }

type SelectionTarget =
  | { kind: 'existing'; sourceIndex: number; displayIndex: number }
  | { kind: 'insert'; insertIndex: number; displayIndex: number }

export function QueryResultGrid({
  result,
  editable = false,
  canPersist = false,
  draft = { edits: {}, inserts: [], deletes: [] },
  onDraftChange,
  pkColumns = [],
  onActiveSourceIndexChange,
  rowActions = false,
  onNearEnd,
  onSumSelectionChange
}: QueryResultGridProps): React.JSX.Element {
  const { t } = useTranslation()
  const [order, setOrder] = useState<number[]>(() => result.columns.map((_, index) => index))
  const [sort, setSort] = useState<GridSort>(null)
  const [selectionMode, setSelectionMode] = useState<'rows' | 'columns' | 'cells'>('rows')
  const selectionModeRef = useRef<'rows' | 'columns' | 'cells'>('rows')
  selectionModeRef.current = selectionMode
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [cellAnchor, setCellAnchor] = useState<CellPos | null>(null)
  const [cellFocus, setCellFocus] = useState<CellPos | null>(null)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const dragFrom = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const anchorRef = useRef<number | null>(null)
  const columnAnchorRef = useRef<number | null>(null)
  const cellAnchorRef = useRef<CellPos | null>(null)
  const selectingKindRef = useRef<'rows' | 'cells' | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const gridActiveRef = useRef(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset UI when row data reloads
  useEffect(() => {
    setOrder(result.columns.map((_, index) => index))
    setSort(null)
    setSelectionMode('rows')
    selectionModeRef.current = 'rows'
    setSelected(new Set())
    setCellAnchor(null)
    setCellFocus(null)
    cellAnchorRef.current = null
    setEditing(null)
    anchorRef.current = null
    columnAnchorRef.current = null
    selectingKindRef.current = null
  }, [result.columns, result.rows])

  const indices = orderedColumnIndices(result.columns.length, order)
  const columnNames = useMemo(() => result.columns.map((column) => column.name), [result.columns])
  const orderedNames = useMemo(
    () =>
      indices
        .map((columnIndex) => result.columns[columnIndex]?.name)
        .filter((name): name is string => Boolean(name)),
    [indices, result.columns]
  )

  const sortedExisting = useMemo(
    () => sortRowsWithIndex(result.rows, result.columns, sort),
    [result.rows, result.columns, sort]
  )

  const displayRows = useMemo(() => {
    const existingSorted = sortedExisting.map((entry) => ({
      kind: 'existing' as const,
      sourceIndex: entry.sourceIndex,
      row: entry.row,
      markedDelete: draft.deletes.includes(entry.sourceIndex)
    }))
    const inserts = draft.inserts.map((row, insertIndex) => ({
      kind: 'insert' as const,
      insertIndex,
      row
    }))
    return [...existingSorted, ...inserts]
  }, [sortedExisting, draft.deletes, draft.inserts])

  const cellRect = useMemo(() => {
    if (selectionMode !== 'cells' || !cellAnchor || !cellFocus) return null
    return cellSelectionRect(cellAnchor, cellFocus, indices)
  }, [cellAnchor, cellFocus, indices, selectionMode])

  const selectedColumnNames = useMemo(() => {
    const columnIds =
      selectionMode === 'columns'
        ? indices.filter((columnIndex) => selected.has(columnIndex))
        : (cellRect?.columnIndices ?? [])
    if (selectionMode !== 'columns' && selectionMode !== 'cells') return []
    return columnIds
      .map((columnIndex) => result.columns[columnIndex]?.name)
      .filter((name): name is string => Boolean(name))
  }, [cellRect, indices, result.columns, selected, selectionMode])

  const selectedRowIndices = useMemo(() => {
    if (selectionMode === 'rows') return selected
    if (selectionMode === 'cells' && cellRect) return new Set(cellRect.displayIndices)
    return new Set<number>()
  }, [cellRect, selected, selectionMode])

  const displayRecords = useMemo(() => {
    return displayRows.map((entry) => {
      const next: Record<string, DatabaseCellValue> = {}
      for (const name of orderedNames) {
        if (entry.kind === 'existing') {
          next[name] = cellDisplayValue(entry.row, name, draft.edits, entry.sourceIndex) ?? null
        } else {
          next[name] = entry.row[name] ?? null
        }
      }
      return next
    })
  }, [displayRows, draft.edits, orderedNames])

  const sumSelectionValues = useMemo(() => {
    if (selectionMode === 'columns' && selectedColumnNames.length > 0) {
      return collectRectValues(
        displayRecords,
        displayRecords.map((_, index) => index),
        selectedColumnNames
      )
    }
    if (selectionMode === 'cells' && cellRect && selectedColumnNames.length > 0) {
      return collectRectValues(displayRecords, cellRect.displayIndices, selectedColumnNames)
    }
    return []
  }, [cellRect, displayRecords, selectedColumnNames, selectionMode])

  useEffect(() => {
    onSumSelectionChange?.(sumSelectionValues)
  }, [onSumSelectionChange, sumSelectionValues])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'c') return
      if (editing || !gridActiveRef.current) return
      if (selectionMode === 'cells') {
        if (!cellRect || cellRect.displayIndices.length === 0) return
      } else if (selected.size === 0) {
        return
      }
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active?.getAttribute('contenteditable') === 'true'
      ) {
        return
      }
      event.preventDefault()
      const text = selectionToTsv({
        mode: selectionMode,
        displayRows: displayRecords,
        orderedColumnNames: orderedNames,
        selectedRowIndices,
        selectedColumnNames
      })
      void navigator.clipboard.writeText(text)
    }
    function onPointerDown(event: PointerEvent): void {
      const root = rootRef.current
      gridActiveRef.current = Boolean(
        root && event.target instanceof Node && root.contains(event.target)
      )
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [
    cellRect,
    displayRecords,
    editing,
    orderedNames,
    selected,
    selectedColumnNames,
    selectedRowIndices,
    selectionMode
  ])

  useEffect(() => {
    function onMouseUp(): void {
      selectingKindRef.current = null
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  useEffect(() => {
    if (!onActiveSourceIndexChange) return
    if (selectionMode !== 'rows' && selectionMode !== 'cells') return
    if (selectedRowIndices.size === 0) {
      if (selectionMode === 'rows') onActiveSourceIndexChange(null)
      return
    }
    const firstDisplay = Math.min(...selectedRowIndices)
    const entry = displayRows[firstDisplay]
    onActiveSourceIndexChange(entry?.kind === 'existing' ? entry.sourceIndex : null)
  }, [displayRows, onActiveSourceIndexChange, selectedRowIndices, selectionMode])

  if (result.columns.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted">
        {result.affectedRows != null
          ? t('database.studio.affected', {
              count: result.affectedRows,
              ms: Math.round(result.durationMs)
            })
          : t('database.studio.noResultSet')}
      </p>
    )
  }

  function clearCellRange(): void {
    cellAnchorRef.current = null
    setCellAnchor(null)
    setCellFocus(null)
  }

  function applyRowSelection(displayIndex: number, event: React.MouseEvent): void {
    const inRows = selectionModeRef.current === 'rows'
    selectionModeRef.current = 'rows'
    setSelectionMode('rows')
    clearCellRange()
    if (event.shiftKey && inRows && anchorRef.current != null) {
      setSelected(new Set(selectRange(anchorRef.current, displayIndex)))
      return
    }
    if (event.metaKey || event.ctrlKey) {
      if (!inRows) {
        setSelected(new Set([displayIndex]))
      } else {
        setSelected((current) => toggleInSet(current, displayIndex))
      }
      anchorRef.current = displayIndex
      return
    }
    setSelected(new Set([displayIndex]))
    anchorRef.current = displayIndex
  }

  function applyColumnSelection(columnIndex: number, event: React.MouseEvent): void {
    const inColumns = selectionModeRef.current === 'columns'
    selectionModeRef.current = 'columns'
    setSelectionMode('columns')
    clearCellRange()
    if (event.shiftKey && inColumns && columnAnchorRef.current != null) {
      setSelected(new Set(selectIndexRange(indices, columnAnchorRef.current, columnIndex)))
      return
    }
    if (event.metaKey || event.ctrlKey) {
      if (!inColumns) {
        setSelected(new Set([columnIndex]))
      } else {
        setSelected((current) => toggleInSet(current, columnIndex))
      }
      columnAnchorRef.current = columnIndex
      return
    }
    setSelected(new Set([columnIndex]))
    columnAnchorRef.current = columnIndex
  }

  function applyCellSelection(
    displayIndex: number,
    columnIndex: number,
    event: React.MouseEvent
  ): void {
    const pos: CellPos = { displayIndex, columnIndex }
    const inCells = selectionModeRef.current === 'cells'
    selectionModeRef.current = 'cells'
    setSelectionMode('cells')
    setSelected(new Set())
    if (event.shiftKey && inCells && cellAnchorRef.current) {
      setCellFocus(pos)
      return
    }
    cellAnchorRef.current = pos
    setCellAnchor(pos)
    setCellFocus(pos)
  }

  function beginCellEdit(target: EditingCell): void {
    if (!editable || !onDraftChange) return
    setEditing(target)
  }

  function commitExistingEdit(sourceIndex: number, column: string, raw: string): void {
    if (!onDraftChange) return
    const original = result.rows[sourceIndex]?.[column]
    const nextValue = parseCellInput(raw, original)
    const next: GridDraft = {
      ...draftRef.current,
      edits: setCellEdit(draftRef.current.edits, sourceIndex, column, original, nextValue)
    }
    draftRef.current = next
    onDraftChange(next)
  }

  function commitInsertEdit(insertIndex: number, column: string, raw: string): void {
    if (!onDraftChange) return
    const previous = draftRef.current.inserts[insertIndex]?.[column]
    const nextValue = parseCellInput(raw, previous)
    const next = setInsertCell(draftRef.current, insertIndex, column, nextValue)
    draftRef.current = next
    onDraftChange(next)
  }

  function revertExistingEdit(sourceIndex: number, column: string, baselineRaw: string): void {
    commitExistingEdit(sourceIndex, column, baselineRaw)
  }

  function revertInsertEdit(insertIndex: number, column: string, baselineRaw: string): void {
    commitInsertEdit(insertIndex, column, baselineRaw)
  }

  function cancelEdit(): void {
    setEditing(null)
  }

  function selectedTargets(): SelectionTarget[] {
    const targets: SelectionTarget[] = []
    for (const displayIndex of [...selectedRowIndices].sort((a, b) => a - b)) {
      const entry = displayRows[displayIndex]
      if (!entry) continue
      if (entry.kind === 'existing') {
        targets.push({ kind: 'existing', sourceIndex: entry.sourceIndex, displayIndex })
      } else {
        targets.push({ kind: 'insert', insertIndex: entry.insertIndex, displayIndex })
      }
    }
    return targets
  }

  function insertEmptyRow(): void {
    if (!editable || !onDraftChange) return
    const next = appendInsert(draftRef.current, emptyRowForColumns(columnNames))
    draftRef.current = next
    onDraftChange(next)
  }

  function duplicateSelected(): void {
    if (!editable || !onDraftChange) return
    const targets = selectedTargets()
    const source =
      targets.find((item) => item.kind === 'existing') ??
      targets.find((item) => item.kind === 'insert')
    if (!source) return
    const current = draftRef.current
    const row =
      source.kind === 'existing'
        ? (() => {
            const base = result.rows[source.sourceIndex]
            if (!base) return null
            const merged: Record<string, DatabaseCellValue> = { ...base }
            const changes = current.edits[source.sourceIndex]
            if (changes) Object.assign(merged, changes)
            return merged
          })()
        : (current.inserts[source.insertIndex] ?? null)
    if (!row) return
    const next = appendInsert(current, duplicateRowValues(row, columnNames, pkColumns))
    draftRef.current = next
    onDraftChange(next)
  }

  function deleteSelected(): void {
    if (!editable || !onDraftChange) return
    const targets = selectedTargets()
    const existingIndices = targets
      .filter(
        (item): item is Extract<SelectionTarget, { kind: 'existing' }> => item.kind === 'existing'
      )
      .map((item) => item.sourceIndex)
    const insertIndices = targets
      .filter(
        (item): item is Extract<SelectionTarget, { kind: 'insert' }> => item.kind === 'insert'
      )
      .map((item) => item.insertIndex)

    let next = draftRef.current
    let changed = false
    if (insertIndices.length > 0) {
      next = removeInserts(next, insertIndices)
      changed = true
    }
    if (existingIndices.length > 0 && canPersist) {
      next = markRowsDeleted(next, existingIndices)
      changed = true
    }
    if (!changed) return
    draftRef.current = next
    onDraftChange(next)
    setSelected(new Set())
    clearCellRange()
  }

  const dirty = hasDirtyDraft(draft)
  const hasSelection = selectedRowIndices.size > 0
  const showRowMenu = rowActions && editable && Boolean(onDraftChange)
  const colSelected = (columnIndex: number): boolean =>
    selectionMode === 'columns' && selected.has(columnIndex)
  const cellSelected = (displayIndex: number, columnIndex: number): boolean =>
    Boolean(cellRect && isCellInRect(displayIndex, columnIndex, cellRect))

  const table = (
    <table
      className={cn(
        'min-w-full border-separate border-spacing-0 text-left font-mono text-[13px]',
        '[&_th]:border-r [&_th]:border-b [&_th]:border-grid-line',
        '[&_td]:border-r [&_td]:border-b [&_td]:border-grid-line'
      )}
    >
      <thead className="sticky top-0 z-10 bg-surface">
        <tr>
          <th className="w-10 px-1 py-1.5 text-center font-medium text-muted select-none">#</th>
          {indices.map((columnIndex) => {
            const column = result.columns[columnIndex]
            if (!column) return null
            const activeSort = sort?.columnIndex === columnIndex ? sort : null
            const columnIsSelected = colSelected(columnIndex)
            return (
              <th
                key={`${column.name}:${String(columnIndex)}`}
                draggable
                data-col-selected={columnIsSelected ? 'true' : undefined}
                aria-sort={
                  activeSort ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                }
                title={t('database.studio.columnHint')}
                onDragStart={(event) => {
                  dragFrom.current = columnIndex
                  dragMoved.current = false
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', column.name)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  dragMoved.current = true
                  event.dataTransfer.dropEffect = 'move'
                  setDragOver(columnIndex)
                }}
                onDragLeave={() => {
                  setDragOver((current) => (current === columnIndex ? null : current))
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const from = dragFrom.current
                  dragFrom.current = null
                  setDragOver(null)
                  if (from === null) return
                  const fromPos = indices.indexOf(from)
                  const toPos = indices.indexOf(columnIndex)
                  setOrder(reorderList(indices, fromPos, toPos))
                }}
                onDragEnd={() => {
                  dragFrom.current = null
                  setDragOver(null)
                }}
                onClick={(event) => {
                  if (dragMoved.current) {
                    dragMoved.current = false
                    return
                  }
                  if ((event.target as HTMLElement).closest('[data-grid-sort]')) return
                  applyColumnSelection(columnIndex, event)
                }}
                className={cn(
                  'cursor-grab whitespace-nowrap px-2 py-1.5 font-medium text-muted select-none active:cursor-grabbing',
                  dragOver === columnIndex ? 'border-l-2 border-l-accent' : '',
                  columnIsSelected ? 'bg-accent/25 text-foreground' : ''
                )}
              >
                <span className="inline-flex items-center gap-1">
                  <span>{column.name}</span>
                  {column.dataType ? (
                    <span className="font-normal text-[10px] uppercase opacity-70">
                      {column.dataType}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    data-grid-sort=""
                    data-testid={`grid-sort-${column.name}`}
                    className="inline-flex size-4 items-center justify-center rounded-sm text-muted hover:text-foreground"
                    aria-label={t('database.studio.sortHint')}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setSort((current) => cycleSort(current, columnIndex))
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    {activeSort ? (
                      activeSort.dir === 'asc' ? (
                        <ArrowUp className="size-3 text-foreground" />
                      ) : (
                        <ArrowDown className="size-3 text-foreground" />
                      )
                    ) : (
                      <ChevronsUpDown className="size-3 opacity-30" />
                    )}
                  </button>
                </span>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {displayRows.length === 0 ? (
          <tr>
            <td
              className="px-2 py-8 text-center text-xs text-muted"
              colSpan={Math.max(indices.length + 1, 1)}
            >
              {t('database.studio.noData')}
            </td>
          </tr>
        ) : (
          displayRows.map((entry, displayIndex) => {
            const isSelected = selectionMode === 'rows' && selected.has(displayIndex)
            const markedDelete = entry.kind === 'existing' && entry.markedDelete
            const isInsert = entry.kind === 'insert'
            return (
              <tr
                key={
                  entry.kind === 'existing'
                    ? `row-${String(entry.sourceIndex)}`
                    : `insert-${String(entry.insertIndex)}`
                }
                data-testid={`grid-row-${String(displayIndex)}`}
                data-selected={isSelected ? 'true' : undefined}
                data-marked-delete={markedDelete ? 'true' : undefined}
                data-insert={isInsert ? 'true' : undefined}
                className={cn(
                  markedDelete
                    ? 'bg-red-500/10 text-red-400 line-through'
                    : isInsert
                      ? 'bg-accent/5'
                      : isSelected
                        ? 'bg-accent/20'
                        : displayIndex % 2 === 1
                          ? 'bg-muted/10'
                          : '',
                  isSelected && !markedDelete ? 'bg-accent/20' : ''
                )}
                onMouseEnter={(event) => {
                  if (selectingKindRef.current !== 'rows' || event.buttons !== 1) return
                  if (anchorRef.current == null) return
                  setSelected(new Set(selectRange(anchorRef.current, displayIndex)))
                }}
                onContextMenu={() => {
                  const inRows = selectionModeRef.current === 'rows'
                  selectionModeRef.current = 'rows'
                  setSelectionMode('rows')
                  clearCellRange()
                  if (!inRows || !selected.has(displayIndex)) {
                    setSelected(new Set([displayIndex]))
                    anchorRef.current = displayIndex
                  }
                }}
              >
                <td
                  className="w-10 cursor-default px-1 py-1.5 text-center tabular-nums text-muted"
                  onMouseDown={(event) => {
                    if (event.button !== 0) return
                    if (event.detail >= 2) return
                    selectingKindRef.current = 'rows'
                    applyRowSelection(displayIndex, event)
                  }}
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  {displayIndex + 1}
                </td>
                {indices.map((columnIndex) => {
                  const column = result.columns[columnIndex]
                  if (!column) return null
                  const dirtyCell =
                    entry.kind === 'existing'
                      ? isCellDirty(draft.edits, entry.sourceIndex, column.name)
                      : entry.row[column.name] !== null
                  const value =
                    entry.kind === 'existing'
                      ? cellDisplayValue(entry.row, column.name, draft.edits, entry.sourceIndex)
                      : entry.row[column.name]
                  const isEditing =
                    entry.kind === 'existing'
                      ? editing?.kind === 'existing' &&
                        editing.sourceIndex === entry.sourceIndex &&
                        editing.column === column.name
                      : editing?.kind === 'insert' &&
                        editing.insertIndex === entry.insertIndex &&
                        editing.column === column.name
                  const columnIsSelected = colSelected(columnIndex)
                  const isCellSelected = cellSelected(displayIndex, columnIndex)
                  function startEdit(): void {
                    if (markedDelete) return
                    if (entry.kind === 'existing') {
                      beginCellEdit({
                        kind: 'existing',
                        sourceIndex: entry.sourceIndex,
                        column: column.name
                      })
                    } else {
                      beginCellEdit({
                        kind: 'insert',
                        insertIndex: entry.insertIndex,
                        column: column.name
                      })
                    }
                  }
                  return (
                    <td
                      key={`${column.name}:${String(columnIndex)}`}
                      data-col-selected={columnIsSelected ? 'true' : undefined}
                      data-cell-selected={isCellSelected ? 'true' : undefined}
                      tabIndex={editable && !markedDelete ? 0 : undefined}
                      className={cn(
                        'relative text-foreground',
                        isEditing ? 'z-20 overflow-visible p-0' : 'max-w-xs truncate px-2 py-1.5',
                        dirtyCell && !markedDelete ? 'bg-accent/10' : '',
                        (columnIsSelected || isCellSelected) && !isSelected && !markedDelete
                          ? 'bg-accent/20'
                          : '',
                        (columnIsSelected || isCellSelected) && isSelected && !markedDelete
                          ? 'bg-accent/30'
                          : ''
                      )}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return
                        if (event.detail >= 2) return
                        if ((event.target as HTMLElement).closest('input')) return
                        selectingKindRef.current = 'cells'
                        applyCellSelection(displayIndex, columnIndex, event)
                      }}
                      onMouseEnter={(event) => {
                        if (selectingKindRef.current !== 'cells' || event.buttons !== 1) return
                        if (selectionModeRef.current !== 'cells' || !cellAnchorRef.current) return
                        setCellFocus({ displayIndex, columnIndex })
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation()
                        startEdit()
                      }}
                      onKeyDown={(event) => {
                        if (editing || markedDelete) return
                        if (event.key !== 'Enter' && event.key !== 'F2') return
                        event.preventDefault()
                        startEdit()
                      }}
                    >
                      {isEditing ? (
                        <>
                          <span
                            className="invisible block truncate px-2 py-1.5 leading-5"
                            aria-hidden
                          >
                            {formatEditValue(value) || ' '}
                          </span>
                          <CellEditor
                            initial={formatEditValue(value)}
                            onLiveChange={(raw) => {
                              if (entry.kind === 'existing') {
                                commitExistingEdit(entry.sourceIndex, column.name, raw)
                              } else {
                                commitInsertEdit(entry.insertIndex, column.name, raw)
                              }
                            }}
                            onCommit={(raw) => {
                              if (entry.kind === 'existing') {
                                commitExistingEdit(entry.sourceIndex, column.name, raw)
                              } else {
                                commitInsertEdit(entry.insertIndex, column.name, raw)
                              }
                              setEditing(null)
                            }}
                            onCancel={(baseline) => {
                              if (entry.kind === 'existing') {
                                revertExistingEdit(entry.sourceIndex, column.name, baseline)
                              } else {
                                revertInsertEdit(entry.insertIndex, column.name, baseline)
                              }
                              cancelEdit()
                            }}
                            onTab={(raw, shift) => {
                              if (entry.kind === 'existing') {
                                commitExistingEdit(entry.sourceIndex, column.name, raw)
                              } else {
                                commitInsertEdit(entry.insertIndex, column.name, raw)
                              }
                              const nextPos = orderedNames.indexOf(column.name) + (shift ? -1 : 1)
                              const nextColumn = orderedNames[nextPos]
                              if (!nextColumn) {
                                setEditing(null)
                                return
                              }
                              setEditing(
                                entry.kind === 'existing'
                                  ? {
                                      kind: 'existing',
                                      sourceIndex: entry.sourceIndex,
                                      column: nextColumn
                                    }
                                  : {
                                      kind: 'insert',
                                      insertIndex: entry.insertIndex,
                                      column: nextColumn
                                    }
                              )
                            }}
                          />
                        </>
                      ) : (
                        <span className="inline-flex max-w-full items-center gap-1">
                          {dirtyCell && !markedDelete ? (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-accent"
                              aria-hidden
                            />
                          ) : null}
                          <span className="truncate">{formatCell(value)}</span>
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )

  return (
    <div
      ref={rootRef}
      className="h-full overflow-auto select-none"
      data-testid="query-result-grid"
      data-dirty={dirty ? 'true' : undefined}
      onScroll={(event) => {
        if (!onNearEnd) return
        const el = event.currentTarget
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
          onNearEnd()
        }
      }}
    >
      {showRowMenu ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="min-h-full">{table}</div>
          </ContextMenuTrigger>
          <ContextMenuContent data-testid="grid-row-context-menu">
            <ContextMenuItem data-testid="grid-insert-row" onSelect={() => insertEmptyRow()}>
              {t('database.studio.insertRow')}
            </ContextMenuItem>
            <ContextMenuItem
              data-testid="grid-duplicate-row"
              disabled={!hasSelection}
              onSelect={() => duplicateSelected()}
            >
              {t('database.studio.duplicateRow')}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              data-testid="grid-delete-rows"
              disabled={
                !hasSelection ||
                (!canPersist && selectedTargets().every((item) => item.kind === 'existing'))
              }
              title={!canPersist ? t('database.studio.saveNoPk') : undefined}
              onSelect={() => deleteSelected()}
            >
              {t('database.studio.deleteRows')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        table
      )}
    </div>
  )
}

function formatCell(value: DatabaseCellValue | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function formatEditValue(value: DatabaseCellValue | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function CellEditor({
  initial,
  onLiveChange,
  onCommit,
  onCancel,
  onTab
}: {
  initial: string
  onLiveChange?: (raw: string) => void
  onCommit: (raw: string) => void
  onCancel: (baseline: string) => void
  onTab: (raw: string, shift: boolean) => void
}): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const baselineRef = useRef(initial)
  const ref = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  function finish(action: () => void): void {
    if (doneRef.current) return
    doneRef.current = true
    action()
  }

  return (
    <input
      ref={ref}
      value={value}
      data-testid="grid-cell-editor"
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      size={Math.max(value.length, 1)}
      className="absolute top-0 left-0 z-20 box-border min-h-full min-w-full appearance-none bg-background px-2.5 py-1.5 font-mono text-[13px] leading-5 text-foreground shadow-sm outline-none ring-1 ring-accent"
      style={{ width: `max(100%, ${String(Math.max(value.length, 1) + 3)}ch)` }}
      onChange={(event) => {
        const next = event.target.value
        setValue(next)
        onLiveChange?.(next)
      }}
      onBlur={() => finish(() => onCommit(value))}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          finish(() => onCancel(baselineRef.current))
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(() => onCommit(value))
          return
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          finish(() => onTab(value, event.shiftKey))
        }
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    />
  )
}
