import { Input } from '@renderer/components/ui/input'
import { QueryResultPane } from '@renderer/features/sessions/QueryResultPane'
import type { GridDraft } from '@renderer/features/sessions/query-result-grid'
import type { DatabaseQueryResult, SqlStudioEngine } from '@shared/protocols'
import { Search } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudioPane } from './studio-tabs'
import { TableFilterInput } from './TableFilterInput'

type TableDataPaneProps = {
  filter: string
  engine: SqlStudioEngine
  /** Column names for the open table (introspection + result headers). */
  columns: readonly string[]
  running: boolean
  result: DatabaseQueryResult | null
  error: string | null
  pane: StudioPane
  editable: boolean
  canPersist: boolean
  draft: GridDraft
  pkColumns: readonly string[]
  columnMeta?: Record<string, { maxLength: number | null; nullable: boolean }>
  canSave: boolean
  saveDisabledReason: string | null
  browseHasMore: boolean
  browseCapReached: boolean
  onFilterChange: (value: string) => void
  onRun: () => void
  onLoadMore: () => void
  onPaneChange: (pane: StudioPane) => void
  onDraftChange: (draft: GridDraft) => void
  onSave: () => void
  onDiscard: () => void
  rowActions?: boolean
}

export function TableDataPane({
  filter,
  engine,
  columns,
  running,
  result,
  error,
  pane,
  editable,
  canPersist,
  draft,
  pkColumns,
  columnMeta,
  canSave,
  saveDisabledReason,
  browseHasMore,
  browseCapReached,
  onFilterChange,
  onRun,
  onLoadMore,
  onPaneChange,
  onDraftChange,
  onSave,
  onDiscard,
  rowActions = true
}: TableDataPaneProps): React.JSX.Element {
  const { t } = useTranslation()
  const filterColumns = useMemo(() => {
    const names = new Set<string>(columns)
    for (const column of result?.columns ?? []) names.add(column.name)
    return [...names]
  }, [columns, result?.columns])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <form
        className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5"
        data-testid="table-filter-bar"
        onSubmit={(event) => {
          event.preventDefault()
          onRun()
        }}
      >
        <Search className="size-3.5 shrink-0 text-muted" />
        <TableFilterInput
          value={filter}
          engine={engine}
          columns={filterColumns}
          placeholder={t('database.studio.filterPlaceholder')}
          aria-label={t('database.studio.filterPlaceholder')}
          onChange={onFilterChange}
          onSubmit={onRun}
        />
        <Input type="submit" className="sr-only" tabIndex={-1} aria-hidden />
      </form>
      <div className="min-h-0 flex-1">
        <QueryResultPane
          result={result}
          error={error}
          pane={pane}
          running={running}
          emptyHint={t('database.studio.tableEmpty')}
          onPaneChange={onPaneChange}
          editable={editable}
          canPersist={canPersist}
          draft={draft}
          onDraftChange={onDraftChange}
          pkColumns={pkColumns}
          columnMeta={columnMeta}
          rowActions={rowActions}
          browseMode
          browseHasMore={browseHasMore}
          browseCapReached={browseCapReached}
          onNearEnd={onLoadMore}
          canSave={canSave}
          saveDisabledReason={saveDisabledReason}
          onSave={onSave}
          onDiscard={onDiscard}
        />
      </div>
    </div>
  )
}
