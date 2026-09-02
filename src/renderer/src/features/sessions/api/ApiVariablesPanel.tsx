import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useVaultAvailable } from '@renderer/hooks/use-vault'
import { cn } from '@renderer/lib/utils'
import type { ApiVariablePublic } from '@shared/types'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type ApiVariablesPanelProps = {
  variables: ApiVariablePublic[]
  onSet: (input: { key: string; value: string | null; isSecret: boolean }) => void
  onDelete: (id: string) => void
}

export function ApiVariablesPanel({
  variables,
  onSet,
  onDelete
}: ApiVariablesPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const { data: vaultAvailable = false } = useVaultAvailable()
  const [draftKey, setDraftKey] = useState('')
  const [draftValue, setDraftValue] = useState('')
  const [draftSecret, setDraftSecret] = useState(false)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 px-2 pt-2 text-[11px] text-muted">
        {t('api.studio.variablesHint', {
          example: `{{${t('api.studio.variablesHintExample')}}}`
        })}
      </p>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center border-b border-border bg-surface px-1 py-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            <span className="px-2">{t('api.studio.key')}</span>
            <span className="px-2">{t('api.studio.value')}</span>
            <span className="w-7" />
          </div>
          {variables.map((variable) => (
            <div
              key={variable.id}
              className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center border-b border-border last:border-b-0"
            >
              <Input
                value={variable.key}
                readOnly
                className="h-7 rounded-none border-0 bg-transparent px-2 text-xs shadow-none"
              />
              <Input
                type={variable.isSecret ? 'password' : 'text'}
                defaultValue={variable.isSecret ? '' : (variable.value ?? '')}
                placeholder={
                  variable.isSecret
                    ? variable.hasSecret
                      ? '••••••••'
                      : t('api.studio.secretPlaceholder')
                    : t('api.studio.value')
                }
                className="h-7 rounded-none border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0"
                onBlur={(event) => {
                  const next = event.target.value
                  if (variable.isSecret && !next.trim()) return
                  if (!variable.isSecret && next === (variable.value ?? '')) return
                  onSet({ key: variable.key, value: next, isSecret: variable.isSecret })
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'size-7 text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                )}
                aria-label={t('common.delete')}
                onClick={() => onDelete(variable.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-t border-border p-1.5">
        <Input
          value={draftKey}
          onChange={(event) => setDraftKey(event.target.value)}
          placeholder={t('api.studio.key')}
          className="h-7 min-w-0 flex-1 text-xs"
        />
        <Input
          type={draftSecret ? 'password' : 'text'}
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          placeholder={draftSecret ? t('api.studio.secretPlaceholder') : t('api.studio.value')}
          className="h-7 min-w-0 flex-1 font-mono text-xs"
        />
        <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={draftSecret}
            disabled={!vaultAvailable}
            onChange={(event) => setDraftSecret(event.target.checked)}
            aria-label={t('api.studio.secret')}
            className="size-3.5 accent-current"
          />
          {t('api.studio.secret')}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!draftKey.trim()}
          aria-label={t('api.studio.addVariable')}
          onClick={() => {
            onSet({ key: draftKey.trim(), value: draftValue, isSecret: draftSecret })
            setDraftKey('')
            setDraftValue('')
            setDraftSecret(false)
          }}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
