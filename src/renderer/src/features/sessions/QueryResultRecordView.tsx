import {
  cellDisplayValue,
  type GridDraft,
  isCellDirty,
  parseCellInput,
  setCellEdit
} from '@renderer/features/sessions/query-result-grid'
import { cn } from '@renderer/lib/utils'
import type { DatabaseCellValue, DatabaseQueryResult } from '@shared/protocols'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type QueryResultRecordViewProps = {
  result: DatabaseQueryResult
  sourceIndex: number
  editable?: boolean
  draft?: GridDraft
  onDraftChange?: (draft: GridDraft) => void
  onNavigate: (direction: -1 | 1) => void
  canPrev: boolean
  canNext: boolean
  positionLabel: string
}

export function QueryResultRecordView({
  result,
  sourceIndex,
  editable = false,
  draft,
  onDraftChange,
  onNavigate,
  canPrev,
  canNext,
  positionLabel
}: QueryResultRecordViewProps): React.JSX.Element {
  const { t } = useTranslation()
  const row = result.rows[sourceIndex]
  const edits = draft?.edits
  const markedDelete = draft?.deletes.includes(sourceIndex) ?? false
  const [editingColumn, setEditingColumn] = useState<string | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  // biome-ignore lint/correctness/useExhaustiveDependencies: clear in-cell editor when the row changes
  useEffect(() => {
    setEditingColumn(null)
  }, [sourceIndex])

  if (!row) {
    return <p className="px-3 py-4 text-xs text-muted">{t('database.studio.noData')}</p>
  }

  const columnNames = result.columns.map((column) => column.name)

  function applyEdit(columnName: string, raw: string): void {
    if (!onDraftChange || !draftRef.current) return
    const original = row?.[columnName]
    const nextValue = parseCellInput(raw, original)
    const next: GridDraft = {
      ...draftRef.current,
      edits: setCellEdit(draftRef.current.edits, sourceIndex, columnName, original, nextValue)
    }
    draftRef.current = next
    onDraftChange(next)
  }

  function beginEdit(columnName: string): void {
    if (!editable || !onDraftChange || markedDelete) return
    setEditingColumn(columnName)
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="query-result-record">
      <div className="query-result-record min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-left font-mono text-[11px]">
          <tbody>
            {result.columns.map((column) => {
              const value = cellDisplayValue(row, column.name, edits, sourceIndex)
              const dirtyCell = isCellDirty(edits, sourceIndex, column.name)
              const isEditing = editingColumn === column.name
              return (
                <tr
                  key={column.name}
                  className={cn(
                    'border-b border-border/60',
                    markedDelete ? 'bg-red-500/10 text-red-400 line-through' : ''
                  )}
                >
                  <th className="w-[40%] max-w-xs truncate bg-surface/60 px-3 py-1.5 text-left font-medium text-muted select-none">
                    {column.name}
                    {column.dataType ? (
                      <span className="ml-1 font-normal text-[10px] uppercase opacity-70">
                        {column.dataType}
                      </span>
                    ) : null}
                  </th>
                  <td
                    className={cn(
                      'relative select-text px-3 py-1.5 text-foreground [-webkit-user-select:text]',
                      dirtyCell && !markedDelete ? 'bg-accent/10' : ''
                    )}
                    tabIndex={editable && !markedDelete ? 0 : undefined}
                    onDoubleClick={() => beginEdit(column.name)}
                    onKeyDown={(event) => {
                      if (editingColumn) return
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        beginEdit(column.name)
                      }
                    }}
                  >
                    {isEditing ? (
                      <RecordCellEditor
                        initial={formatEditValue(value)}
                        onLiveChange={(raw) => applyEdit(column.name, raw)}
                        onCancel={(baseline) => {
                          applyEdit(column.name, baseline)
                          setEditingColumn(null)
                        }}
                        onCommit={(raw) => {
                          applyEdit(column.name, raw)
                          setEditingColumn(null)
                        }}
                        onTab={(raw, shift) => {
                          applyEdit(column.name, raw)
                          const nextPos = columnNames.indexOf(column.name) + (shift ? -1 : 1)
                          const nextColumn = columnNames[nextPos]
                          setEditingColumn(nextColumn ?? null)
                        }}
                      />
                    ) : (
                      <span className="inline-flex max-w-full items-center gap-1.5 select-text [-webkit-user-select:text]">
                        {dirtyCell && !markedDelete ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                        ) : null}
                        <span className="select-text break-all [-webkit-user-select:text]">
                          {formatCell(value)}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-t border-border px-2 text-[11px] text-muted">
        <span data-testid="record-position">{positionLabel}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-sm hover:bg-surface-elevated disabled:opacity-40"
            aria-label={t('database.studio.recordPrev')}
            disabled={!canPrev}
            onClick={() => onNavigate(-1)}
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-sm hover:bg-surface-elevated disabled:opacity-40"
            aria-label={t('database.studio.recordNext')}
            disabled={!canNext}
            onClick={() => onNavigate(1)}
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      </div>
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

function RecordCellEditor({
  initial,
  onLiveChange,
  onCancel,
  onCommit,
  onTab
}: {
  initial: string
  onLiveChange?: (raw: string) => void
  onCancel: (baseline: string) => void
  onCommit: (raw: string) => void
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
      className="w-full rounded-sm border border-accent bg-background px-1 py-0.5 text-[11px] text-foreground outline-none"
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
    />
  )
}
