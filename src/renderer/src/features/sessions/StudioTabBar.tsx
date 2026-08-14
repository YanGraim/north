import { Button } from '@renderer/components/ui/button'
import { shortcutDisplayLabel } from '@renderer/lib/shortcuts'
import { cn } from '@renderer/lib/utils'
import { AlignLeft, Code2, Play, Plus, Square, Table2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { StudioTab } from './studio-tabs'

type StudioTabBarProps = {
  tabs: StudioTab[]
  activeId: string | null
  running: boolean
  canRun: boolean
  canFormat?: boolean
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onNewQuery: () => void
  onRun: () => void
  onCancel: () => void
  onFormat?: () => void
}

export function StudioTabBar({
  tabs,
  activeId,
  running,
  canRun,
  canFormat = false,
  onActivate,
  onClose,
  onNewQuery,
  onRun,
  onCancel,
  onFormat
}: StudioTabBarProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div
      role="tablist"
      aria-label={t('database.studio.tabs')}
      className={cn(
        'flex h-8 shrink-0 items-stretch overflow-x-auto overflow-y-hidden border-b border-border bg-surface',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      )}
      data-testid="studio-tab-bar"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        const title =
          tab.kind === 'table'
            ? t('database.studio.tableAll', { table: tab.table })
            : t('database.studio.queryN', { n: tab.queryNumber })
        const testId =
          tab.kind === 'table' ? `studio-tab-${tab.table}` : `studio-tab-query-${tab.queryNumber}`
        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={active}
            data-testid={testId}
            onClick={() => onActivate(tab.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onActivate(tab.id)
              }
            }}
            className={cn(
              'group flex h-8 max-w-[14rem] shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-2.5 text-[12px]',
              active
                ? 'bg-background text-foreground'
                : 'bg-surface text-muted hover:text-foreground'
            )}
          >
            {tab.kind === 'table' ? (
              <Table2 className="size-3 shrink-0" />
            ) : (
              <Code2 className="size-3 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{title}</span>
            <button
              type="button"
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted opacity-0 group-hover:opacity-100 hover:bg-surface-elevated hover:text-foreground"
              aria-label={t('database.studio.closeTab', { title })}
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab.id)
              }}
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-none"
        aria-label={t('database.studio.newQuery')}
        data-testid="studio-new-query"
        onClick={onNewQuery}
      >
        <Plus className="size-3.5" />
      </Button>
      <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-border px-1">
        {onFormat ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            data-testid="studio-format"
            disabled={!canFormat}
            title={`${t('database.studio.format')} (${shortcutDisplayLabel('formatSql')})`}
            aria-label={t('database.studio.format')}
            onClick={onFormat}
          >
            <AlignLeft className="size-3" />
            {t('database.studio.format')}
          </Button>
        ) : null}
        {running ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            data-testid="studio-cancel"
            onClick={onCancel}
          >
            <Square className="size-3" />
            {t('database.studio.cancel')}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            data-testid="studio-run"
            disabled={!canRun}
            onClick={onRun}
          >
            <Play className="size-3" />
            {t('database.studio.run')}
          </Button>
        )}
      </div>
    </div>
  )
}
