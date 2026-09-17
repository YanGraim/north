import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import type { ApiKeyValue } from '@shared/types'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { VariableInput } from './VariableInput'

type KeyValueEditorProps = {
  items: ApiKeyValue[]
  onChange: (items: ApiKeyValue[]) => void
  /** Names resolvable for the currently selected environment — drives autocomplete + highlighting. */
  variables?: readonly string[]
  /** Resolved value per variable name, shown in the hover tooltip over a `{{var}}` token. */
  variableValues?: Readonly<Record<string, string>>
  keyPlaceholder?: string
  valuePlaceholder?: string
}

const emptyRow: ApiKeyValue = { key: '', value: '', enabled: true }

export function KeyValueEditor({
  items,
  onChange,
  variables = [],
  variableValues,
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
    <div className="flex flex-col gap-1">
      {rows.map((item, index) => {
        const phantom = index >= items.length
        return (
          <div
            key={index}
            className={cn(
              'group grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1.5',
              !item.enabled && !phantom && 'opacity-50'
            )}
          >
            <Checkbox
              checked={item.enabled}
              onCheckedChange={(checked) => patch(index, { enabled: checked === true })}
              aria-label={t('api.studio.enabled')}
              className="size-3.5"
            />
            <Input
              value={item.key}
              onChange={(event) => patch(index, { key: event.target.value })}
              placeholder={keyPlaceholder ?? t('api.studio.key')}
              className="h-7 px-2 font-mono text-xs"
            />
            <VariableInput
              value={item.value}
              variables={variables}
              variableValues={variableValues}
              onChange={(value) => patch(index, { value })}
              placeholder={valuePlaceholder ?? t('api.studio.value')}
              className="h-7 px-2 font-mono text-xs"
            />
            {phantom ? (
              <span className="size-7" />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'size-7 text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'
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
