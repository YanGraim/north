import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { cn } from '@renderer/lib/utils'
import type { ApiFormField } from '@shared/types'
import { Paperclip, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { VariableInput } from './VariableInput'

/** File name for display; paths may come from any OS (imported collections). */
export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

type FormDataEditorProps = {
  items: ApiFormField[]
  onChange: (items: ApiFormField[]) => void
  variables?: readonly string[]
  variableValues?: Readonly<Record<string, string>>
}

const emptyRow: ApiFormField = { key: '', value: '', enabled: true }

/**
 * Multipart editor, Postman-style: each row is Text or File. File rows hold
 * local paths only; main reads the files when the request is sent.
 */
export function FormDataEditor({
  items,
  onChange,
  variables = [],
  variableValues
}: FormDataEditorProps): React.JSX.Element {
  const { t } = useTranslation()
  const last = items[items.length - 1]
  const needsPhantom =
    last == null || last.key !== '' || last.value !== '' || (last.src?.length ?? 0) > 0
  const rows = needsPhantom ? [...items, emptyRow] : items

  function patch(index: number, next: Partial<ApiFormField>): void {
    if (index >= items.length) {
      onChange([...items, { ...emptyRow, ...next }])
      return
    }
    onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)))
  }

  async function pickFiles(index: number): Promise<void> {
    const paths = await window.north.api.pickFiles({ multiple: true })
    if (paths.length === 0) return
    const current = rows[index]?.src ?? []
    patch(index, { src: [...current, ...paths.filter((path) => !current.includes(path))] })
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((item, index) => {
        const phantom = index >= items.length
        const isFile = item.type === 'file'
        const src = item.src ?? []
        return (
          <div
            key={index}
            className={cn(
              'group grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5',
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
              placeholder={t('api.studio.key')}
              className="h-7 px-2 font-mono text-xs"
            />
            <Select
              value={isFile ? 'file' : 'text'}
              onValueChange={(value) =>
                patch(
                  index,
                  value === 'file'
                    ? { type: 'file', value: '', src: [] }
                    : { type: 'text', src: undefined }
                )
              }
            >
              <SelectTrigger
                className="h-7 w-20 text-xs"
                aria-label={t('api.studio.fieldType')}
                data-testid="api-form-field-type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">{t('api.studio.fieldText')}</SelectItem>
                <SelectItem value="file">{t('api.studio.fieldFile')}</SelectItem>
              </SelectContent>
            </Select>
            {isFile ? (
              <div className="flex min-h-7 flex-wrap items-center gap-1">
                {src.map((path) => (
                  <span
                    key={path}
                    title={path}
                    className="inline-flex max-w-full items-center gap-1 rounded border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-xs"
                  >
                    <span className="truncate">{fileName(path)}</span>
                    <button
                      type="button"
                      className="text-muted hover:text-foreground"
                      aria-label={t('api.studio.removeFile')}
                      onClick={() => patch(index, { src: src.filter((p) => p !== path) })}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted hover:text-foreground"
                  onClick={() => void pickFiles(index)}
                >
                  <Paperclip className="size-3.5" />
                  {t('api.studio.selectFiles')}
                </Button>
              </div>
            ) : (
              <VariableInput
                value={item.value}
                variables={variables}
                variableValues={variableValues}
                onChange={(value) => patch(index, { value })}
                placeholder={t('api.studio.value')}
                className="h-7 px-2 font-mono text-xs"
              />
            )}
            {phantom ? (
              <span className="size-7" />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
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
