import { Button } from '@renderer/components/ui/button'
import { QueryResultGrid } from '@renderer/features/sessions/QueryResultGrid'
import { QueryResultRecordView } from '@renderer/features/sessions/QueryResultRecordView'
import {
  emptyGridDraft,
  type GridDraft,
  hasDirtyDraft,
  sumNumericCells
} from '@renderer/features/sessions/query-result-grid'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { cn } from '@renderer/lib/utils'
import type { DatabaseCellValue, DatabaseQueryResult } from '@shared/protocols'
import { LayoutList, Loader2, Save, Sigma, Table2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudioPane } from './studio-tabs'

export type ResultViewMode = 'grid' | 'record'

type QueryResultPaneProps = {
  result: DatabaseQueryResult | null
  error: string | null
  pane: StudioPane
  running: boolean
  emptyHint: string
  onPaneChange: (pane: StudioPane) => void
  editable?: boolean
  canPersist?: boolean
  draft?: GridDraft
  onDraftChange?: (draft: GridDraft) => void
  pkColumns?: readonly string[]
  columnMeta?: Record<string, { maxLength: number | null; nullable: boolean }>
  rowActions?: boolean
  /** Table-tab browse: DBeaver-style count (200+) and infinite scroll. */
  browseMode?: boolean
  browseHasMore?: boolean
  browseCapReached?: boolean
  onNearEnd?: () => void
  canSave?: boolean
  saveDisabledReason?: string | null
  onSave?: () => void
  onDiscard?: () => void
}

export function QueryResultPane({
  result,
  error,
  pane,
  running,
  emptyHint,
  onPaneChange,
  editable = false,
  canPersist = false,
  draft,
  onDraftChange,
  pkColumns = [],
  columnMeta,
  rowActions = false,
  browseMode = false,
  browseHasMore = false,
  browseCapReached = false,
  onNearEnd,
  canSave = false,
  saveDisabledReason,
  onSave,
  onDiscard
}: QueryResultPaneProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const hasError = Boolean(error)
  const activePane: StudioPane = hasError && pane === 'messages' ? 'messages' : 'results'
  const [viewMode, setViewMode] = useState<ResultViewMode>('grid')
  const [activeSourceIndex, setActiveSourceIndex] = useState<number | null>(null)
  const [selectedValues, setSelectedValues] = useState<DatabaseCellValue[]>([])
  const activeDraft = draft ?? emptyGridDraft()

  useEffect(() => {
    setActiveSourceIndex(result && result.rows.length > 0 ? 0 : null)
    setSelectedValues([])
  }, [result])

  useEffect(() => {
    if (viewMode !== 'grid') {
      setSelectedValues([])
    }
  }, [viewMode])

  const handleSumSelectionChange = useCallback((values: DatabaseCellValue[]) => {
    setSelectedValues((current) => {
      if (
        current.length === values.length &&
        current.every((value, index) => value === values[index])
      ) {
        return current
      }
      return values
    })
  }, [])

  const recordIndex =
    activeSourceIndex != null && result && result.rows[activeSourceIndex]
      ? activeSourceIndex
      : result && result.rows.length > 0
        ? 0
        : null

  const statusMeta = result
    ? result.affectedRows != null && result.columns.length === 0
      ? t('database.studio.affected', {
          count: result.affectedRows,
          ms: Math.round(result.durationMs)
        })
      : browseMode
        ? formatBrowseStatus(
            t,
            result.rows.length + activeDraft.inserts.length,
            browseHasMore,
            browseCapReached,
            result.durationMs
          )
        : t('database.studio.rowMeta', {
            count: result.rowCount + activeDraft.inserts.length,
            truncated: result.truncated ? t('database.studio.truncated') : '',
            ms: Math.round(result.durationMs)
          })
    : null

  function navigateRecord(direction: -1 | 1): void {
    if (!result || recordIndex == null) return
    const next = recordIndex + direction
    if (next < 0 || next >= result.rows.length) return
    setActiveSourceIndex(next)
    if (browseHasMore && onNearEnd && next >= result.rows.length - 5) {
      onNearEnd()
    }
  }

  const recordTotalLabel =
    browseMode && browseHasMore
      ? t('database.studio.browseCountMore', { count: result?.rows.length ?? 0 })
      : String(result?.rows.length ?? 0)

  const dirty = hasDirtyDraft(activeDraft)
  const showFooterActions = dirty && Boolean(onSave && onDiscard)
  const columnSum = sumNumericCells(selectedValues)
  const canSum = columnSum !== null
  const formattedSum =
    columnSum == null
      ? null
      : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 10 }).format(columnSum)
  const clipboardSum =
    columnSum == null
      ? null
      : new Intl.NumberFormat('en-US', {
          useGrouping: false,
          maximumFractionDigits: 10
        }).format(columnSum)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2">
        <button
          type="button"
          className={cn(
            'h-8 px-2 text-xs',
            activePane === 'results' ? 'border-b-2 border-accent text-foreground' : 'text-muted'
          )}
          onClick={() => onPaneChange('results')}
        >
          {t('database.studio.results')}
        </button>
        {hasError ? (
          <button
            type="button"
            className={cn(
              'relative h-8 px-2 text-xs',
              activePane === 'messages' ? 'border-b-2 border-accent text-foreground' : 'text-muted'
            )}
            onClick={() => onPaneChange('messages')}
            data-testid="studio-messages-tab"
          >
            {t('database.studio.messages')}
            <span
              className="absolute right-0.5 top-1.5 size-1.5 rounded-full bg-red-500"
              aria-hidden
            />
          </button>
        ) : null}
        {activePane === 'results' && result && result.columns.length > 0 ? (
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-sm',
                viewMode === 'grid'
                  ? 'bg-surface-elevated text-foreground'
                  : 'text-muted hover:text-foreground'
              )}
              aria-pressed={viewMode === 'grid'}
              aria-label={t('database.studio.viewGrid')}
              data-testid="view-mode-grid"
              onClick={() => setViewMode('grid')}
            >
              <Table2 className="size-3.5" />
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-sm',
                viewMode === 'record'
                  ? 'bg-surface-elevated text-foreground'
                  : 'text-muted hover:text-foreground'
              )}
              aria-pressed={viewMode === 'record'}
              aria-label={t('database.studio.viewRecord')}
              data-testid="view-mode-record"
              onClick={() => setViewMode('record')}
            >
              <LayoutList className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        {activePane === 'messages' && error ? (
          <p
            className="whitespace-pre-wrap px-3 py-4 font-mono text-xs text-foreground"
            data-testid="studio-messages"
          >
            {error}
          </p>
        ) : result ? (
          viewMode === 'record' && result.columns.length > 0 && recordIndex != null ? (
            <QueryResultRecordView
              result={result}
              sourceIndex={recordIndex}
              editable={editable}
              draft={activeDraft}
              onDraftChange={onDraftChange}
              columnMeta={columnMeta}
              onNavigate={navigateRecord}
              canPrev={recordIndex > 0}
              canNext={recordIndex < result.rows.length - 1 || browseHasMore}
              positionLabel={t('database.studio.recordPosition', {
                current: recordIndex + 1,
                total: recordTotalLabel
              })}
            />
          ) : (
            <QueryResultGrid
              result={result}
              editable={editable}
              canPersist={canPersist}
              draft={activeDraft}
              onDraftChange={onDraftChange}
              pkColumns={pkColumns}
              columnMeta={columnMeta}
              rowActions={rowActions}
              onActiveSourceIndexChange={setActiveSourceIndex}
              onSumSelectionChange={handleSumSelectionChange}
              onNearEnd={browseMode ? onNearEnd : undefined}
            />
          )
        ) : (
          <p className="px-3 py-4 text-xs text-muted">{emptyHint}</p>
        )}
      </div>
      <div
        className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-border px-2 text-[11px] text-muted"
        data-testid="studio-result-status"
      >
        <div className="flex min-w-0 items-center gap-1">
          {showFooterActions ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 gap-1 px-1.5 text-[11px]"
                data-testid="studio-save"
                disabled={!canSave}
                title={saveDisabledReason ?? undefined}
                onClick={onSave}
              >
                <Save className="size-3" />
                {t('common.save')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 gap-1 px-1.5 text-[11px]"
                data-testid="studio-discard"
                onClick={onDiscard}
              >
                <X className="size-3" />
                {t('common.cancel')}
              </Button>
            </>
          ) : null}
          {running ? (
            <Loader2 className="size-3.5 animate-spin" aria-label={t('database.studio.run')} />
          ) : hasError && !showFooterActions ? (
            <button
              type="button"
              className="text-red-400 hover:underline"
              onClick={() => onPaneChange('messages')}
            >
              {t('database.studio.errorOpen')}
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasError && showFooterActions ? (
            <button
              type="button"
              className="text-red-400 hover:underline"
              onClick={() => onPaneChange('messages')}
            >
              {t('database.studio.errorOpen')}
            </button>
          ) : null}
          {result && result.columns.length > 0 && viewMode === 'grid' ? (
            <>
              <button
                type="button"
                className={cn(
                  'inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11px]',
                  canSum ? 'text-foreground hover:bg-surface-elevated' : 'cursor-default text-muted'
                )}
                data-testid="studio-column-sum"
                disabled={!canSum}
                aria-label={canSum ? t('database.studio.copySum') : undefined}
                title={canSum ? t('database.studio.copySum') : t('database.studio.sumHint')}
                onClick={() => {
                  if (clipboardSum == null) return
                  void copyToClipboard(clipboardSum, t('database.studio.sum'))
                }}
              >
                <Sigma className="size-3" />
                {formattedSum != null ? (
                  <span className="tabular-nums" data-testid="studio-column-sum-total">
                    {t('database.studio.sumTotal', { value: formattedSum })}
                  </span>
                ) : (
                  t('database.studio.sum')
                )}
              </button>
            </>
          ) : null}
          {!running && !hasError && statusMeta ? (
            <span className="truncate tabular-nums" data-dirty={dirty ? 'true' : undefined}>
              {statusMeta}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function formatBrowseStatus(
  t: (key: string, options?: Record<string, unknown>) => string,
  count: number,
  hasMore: boolean,
  capReached: boolean,
  durationMs: number
): string {
  const ms = Math.round(durationMs)
  const countLabel = hasMore
    ? t('database.studio.browseCountMore', { count })
    : t('database.studio.browseCountExact', { count })
  const base = t('database.studio.browseMeta', { count: countLabel, ms })
  if (capReached) {
    return `${base}${t('database.studio.browseCap')}`
  }
  return base
}
