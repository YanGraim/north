import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import type { ApiRequestHistoryEntry } from '@shared/types'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type ApiHistoryPanelProps = {
  entries: ApiRequestHistoryEntry[]
  onOpen: (entry: ApiRequestHistoryEntry) => void
}

function matchesHistory(entry: ApiRequestHistoryEntry, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    entry.method.toLowerCase().includes(needle) ||
    entry.url.toLowerCase().includes(needle) ||
    String(entry.statusCode ?? '').includes(needle) ||
    (entry.errorKind?.toLowerCase().includes(needle) ?? false)
  )
}

export function ApiHistoryPanel({ entries, onOpen }: ApiHistoryPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const visible = useMemo(
    () => entries.filter((entry) => matchesHistory(entry, query)),
    [entries, query]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative shrink-0 border-b border-border p-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('api.studio.searchHistory')}
          aria-label={t('api.studio.searchHistory')}
          className="h-7 pl-7 text-xs"
        />
      </div>
      {entries.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted">{t('api.studio.emptyHistory')}</p>
      ) : visible.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted">
          {t('api.studio.emptyHistorySearch')}
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="p-1">
            {visible.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left hover:bg-surface-elevated"
                  onClick={() => onOpen(entry)}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-12 shrink-0 font-mono text-[10px] text-muted">
                      {entry.method}
                    </span>
                    <span
                      className={cn(
                        'text-[11px]',
                        entry.statusCode && entry.statusCode >= 400
                          ? 'text-red-400'
                          : 'text-foreground'
                      )}
                    >
                      {entry.statusCode ?? entry.errorKind ?? '—'}
                    </span>
                    <span className="ml-auto text-[10px] text-muted">
                      {entry.durationMs != null ? `${entry.durationMs} ms` : ''}
                    </span>
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted">{entry.url}</span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
