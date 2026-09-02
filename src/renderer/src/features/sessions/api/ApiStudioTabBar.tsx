import { Button } from '@renderer/components/ui/button'
import { shortcutDisplayLabel } from '@renderer/lib/shortcuts'
import { cn } from '@renderer/lib/utils'
import { Play, Plus, Square, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ApiStudioTab } from '../api-studio-tabs'

type ApiStudioTabBarProps = {
  tabs: ApiStudioTab[]
  activeId: string | null
  sending: boolean
  canSend: boolean
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
  onSend: () => void
  onCancel: () => void
}

export function ApiStudioTabBar({
  tabs,
  activeId,
  sending,
  canSend,
  onActivate,
  onClose,
  onNew,
  onSend,
  onCancel
}: ApiStudioTabBarProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div
      role="tablist"
      aria-label={t('api.studio.tabs')}
      className={cn(
        'flex h-8 shrink-0 items-stretch overflow-x-auto overflow-y-hidden border-b border-border bg-surface',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      )}
      data-testid="api-studio-tab-bar"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        const title = `${tab.method} ${tab.name}`
        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={active}
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
            <span className="min-w-0 flex-1 truncate">{title}</span>
            <button
              type="button"
              className={cn(
                'inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-elevated hover:text-foreground',
                tab.dirty ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              aria-label={t('api.studio.closeTab', { title })}
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab.id)
              }}
            >
              {tab.dirty ? (
                <>
                  <span className="size-1.5 rounded-full bg-current group-hover:hidden" />
                  <X className="hidden size-3 group-hover:block" />
                </>
              ) : (
                <X className="size-3" />
              )}
            </button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-none"
        aria-label={t('api.studio.newRequest')}
        onClick={onNew}
      >
        <Plus className="size-3.5" />
      </Button>
      <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-border px-1">
        {sending ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            data-testid="api-cancel"
            onClick={onCancel}
          >
            <Square className="size-3" />
            {t('api.studio.cancel')}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            data-testid="api-send"
            disabled={!canSend}
            title={`${t('api.studio.send')} (${shortcutDisplayLabel('sendRequest')})`}
            onClick={onSend}
          >
            <Play className="size-3" />
            {t('api.studio.send')}
          </Button>
        )}
      </div>
    </div>
  )
}
