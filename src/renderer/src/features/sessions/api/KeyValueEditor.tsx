import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import type { ApiKeyValue } from '@shared/types'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type KeyValueEditorProps = {
  items: ApiKeyValue[]
  onChange: (items: ApiKeyValue[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}

const emptyRow: ApiKeyValue = { key: '', value: '', enabled: true }

export function KeyValueEditor({
  items,
  onChange,
  keyPlaceholder,
  valuePlaceholder
}: KeyValueEditorProps): React.JSX.Element {
  const { t } = useTranslation()
  const last = items[items.length - 1]
  const needsPhantom = last == null || last.key !== '' || last.value !== ''
  const rows = needsPhantom ? [...items, emptyRow] : items

  function patch(index: number, next: Partial<ApiKeyValue>): void {
    if (index >= items.length) {
      onChange([...items, { ...emptyRow, ...next }])
      return
    }
    onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)))
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center border-b border-border bg-surface px-1 py-1 text-[10px] font-medium uppercase tracking-wide text-muted">
        <span className="w-6" />
        <span className="px-2">{t('api.studio.key')}</span>
        <span className="px-2">{t('api.studio.value')}</span>
        <span className="w-7" />
      </div>
      {rows.map((item, index) => {
        const phantom = index >= items.length
        return (
          <div
            key={index}
            className="group grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center border-b border-border last:border-b-0"
          >
            <label className="flex size-7 items-center justify-center">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(event) => patch(index, { enabled: event.target.checked })}
                aria-label={t('api.studio.enabled')}
                className="size-3.5 accent-current"
              />
            </label>
            <Input
              value={item.key}
              onChange={(event) => patch(index, { key: event.target.value })}
              placeholder={keyPlaceholder ?? t('api.studio.key')}
              className="h-7 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
            />
            <Input
              value={item.value}
              onChange={(event) => patch(index, { value: event.target.value })}
              placeholder={valuePlaceholder ?? t('api.studio.value')}
              className="h-7 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
            />
            {phantom ? (
              <span className="size-7" />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'size-7 text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                )}
                aria-label={t('common.delete')}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
