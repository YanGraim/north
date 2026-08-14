import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  appendInsert,
  cellDisplayValue,
  cycleSort,
  duplicateRowValues,
  emptyRowForColumns,
  type GridDraft,
  type GridSort,
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
  onNearEnd
}: QueryResultGridProps): React.JSX.Element {
  const { t } = useTranslation()
  const [order, setOrder] = useState<number[]>(() => result.columns.map((_, index) => index))
  const [sort, setSort] = useState<GridSort>(null)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const dragFrom = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const anchorRef = useRef<number | null>(null)
  const selectingRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const gridActiveRef = useRef(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset UI when row data reloads
  useEffect(() => {
    setOrder(result.columns.map((_, index) => index))
    setSort(null)
    setSelected(new Set())
    setEditing(null)
    anchorRef.current = null
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'c') return
      if (editing || !gridActiveRef.current || selected.size === 0) return
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active?.getAttribute('contenteditable') === 'true'
      ) {
        return
      }
      event.preventDefault()
      const rows = displayRows
        .filter((_, displayIndex) => selected.has(displayIndex))
        .map((entry) => {
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
      void navigator.clipboard.writeText(rowsToTsv(rows, orderedNames))
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
  }, [displayRows, draft.edits, editing, orderedNames, selected])

  useEffect(() => {
    function onMouseUp(): void {
      selectingRef.current = false
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  useEffect(() => {
    if (!onActiveSourceIndexChange) return
    if (selected.size === 0) {
      onActiveSourceIndexChange(null)
      return
    }
    const firstDisplay = Math.min(...selected)
    const entry = displayRows[firstDisplay]
    onActiveSourceIndexChange(entry?.kind === 'existing' ? entry.sourceIndex : null)
  }, [displayRows, onActiveSourceIndexChange, selected])

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

  function applyRowSelection(displayIndex: number, event: React.MouseEvent): void {
    if (event.shiftKey && anchorRef.current != null) {
      setSelected(new Set(selectRange(anchorRef.current, displayIndex)))
      return
    }
    if (event.metaKey || event.ctrlKey) {
      setSelected((current) => toggleInSet(current, displayIndex))
      anchorRef.current = displayIndex
      return
    }
    setSelected(new Set([displayIndex]))
    anchorRef.current = displayIndex
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
    for (const displayIndex of [...selected].sort((a, b) => a - b)) {
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
  }

  const dirty = hasDirtyDraft(draft)
  const hasSelection = selected.size > 0
  const showRowMenu = rowActions && editable && Boolean(onDraftChange)

  const table = (
    <table className="min-w-full border-collapse text-left font-mono text-[11px]">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="border-b border-border">
          <th className="w-10 px-1 py-1.5 text-center font-medium text-muted select-none">#</th>
          {indices.map((columnIndex) => {
            const column = result.columns[columnIndex]
            if (!column) return null
            const activeSort = sort?.columnIndex === columnIndex ? sort : null
            return (
              <th
                key={`${column.name}:${String(columnIndex)}`}
                draggable
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
                onClick={() => {
                  if (dragMoved.current) {
                    dragMoved.current = false
                    return
                  }
                  setSort((current) => cycleSort(current, columnIndex))
                  setSelected(new Set())
                }}
                className={cn(
                  'cursor-grab whitespace-nowrap px-2 py-1.5 font-medium text-muted select-none active:cursor-grabbing',
                  dragOver === columnIndex ? 'border-l-2 border-l-accent' : ''
                )}
              >
                <span className="inline-flex items-center gap-1">
                  <span>{column.name}</span>
                  {column.dataType ? (
                    <span className="font-normal text-[10px] uppercase opacity-70">
                      {column.dataType}
                    </span>
                  ) : null}
                  {activeSort ? (
                    activeSort.dir === 'asc' ? (
                      <ArrowUp className="size-3 text-foreground" />
                    ) : (
                      <ArrowDown className="size-3 text-foreground" />
                    )
                  ) : (
                    <ChevronsUpDown className="size-3 opacity-30" />
                  )}
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
            const isSelected = selected.has(displayIndex)
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
                  'border-b border-border/60',
                  markedDelete
                    ? 'bg-red-500/10 text-red-400 line-through'
                    : isInsert
                      ? 'bg-accent/5'
                      : isSelected
                        ? 'bg-accent/20'
                        : displayIndex % 2 === 1
                          ? 'bg-surface-elevated/40'
                          : '',
                  isSelected && !markedDelete ? 'bg-accent/20' : ''
                )}
                onMouseDown={(event) => {
                  if (event.button !== 0) return
                  if (event.detail >= 2) return
                  if ((event.target as HTMLElement).closest('input')) return
                  selectingRef.current = true
                  applyRowSelection(displayIndex, event)
                }}
                onMouseEnter={(event) => {
                  if (!selectingRef.current || event.buttons !== 1) return
                  if (anchorRef.current == null) return
                  setSelected(new Set(selectRange(anchorRef.current, displayIndex)))
                }}
                onContextMenu={() => {
                  if (!selected.has(displayIndex)) {
                    setSelected(new Set([displayIndex]))
                    anchorRef.current = displayIndex
                  }
                }}
              >
                <td
                  className="w-10 cursor-default px-1 py-1 text-center tabular-nums text-muted"
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
                  return (
                    <td
                      key={`${column.name}:${String(columnIndex)}`}
                      className={cn(
                        'relative max-w-xs truncate px-2 py-1 text-foreground',
                        dirtyCell && !markedDelete ? 'bg-accent/10' : ''
                      )}
                      onDoubleClick={(event) => {
                        event.stopPropagation()
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
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' || editing || markedDelete) return
                        event.preventDefault()
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
                      }}
                    >
                      {isEditing ? (
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
      className="absolute inset-0 z-10 h-full w-full border border-accent bg-background px-2 font-mono text-[11px] text-foreground outline-none"
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
