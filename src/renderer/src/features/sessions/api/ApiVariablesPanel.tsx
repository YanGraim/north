import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Input } from '@renderer/components/ui/input'
import { useRevealSecret, useVaultAvailable } from '@renderer/hooks/use-vault'
import type { ApiVariablePublic } from '@shared/types'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const REVEAL_TTL_MS = 15_000

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
  const revealSecret = useRevealSecret()
  const [draftKey, setDraftKey] = useState('')
  const [draftValue, setDraftValue] = useState('')
  const [draftSecret, setDraftSecret] = useState(false)
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null)

  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(() => setRevealed(null), REVEAL_TTL_MS)
    return () => window.clearTimeout(timer)
  }, [revealed])

  async function handleReveal(variable: ApiVariablePublic): Promise<void> {
    if (revealed?.id === variable.id) {
      setRevealed(null)
      return
    }
    if (!variable.credentialRef) return
    try {
      const secret = await revealSecret.mutateAsync(variable.credentialRef)
      setRevealed({ id: variable.id, secret })
    } catch {
      /* toast already shown */
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 px-2 pt-2 text-[11px] text-muted">
        {t('api.studio.variablesHint', {
          example: `{{${t('api.studio.variablesHintExample')}}}`
        })}
      </p>
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        <div className="flex flex-col divide-y divide-border/50">
          {variables.map((variable) => {
            const shownSecret = revealed?.id === variable.id ? revealed.secret : null
            return (
              <div key={variable.id} className="group flex flex-col gap-1 py-2 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-foreground">{variable.key}</span>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    {variable.isSecret && variable.hasSecret ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 text-muted"
                        aria-label={t('api.studio.revealSecret')}
                        disabled={revealSecret.isPending}
                        onClick={() => handleReveal(variable)}
                      >
                        {shownSecret ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 text-muted"
                      aria-label={t('common.delete')}
                      onClick={() => onDelete(variable.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <Input
                  type={variable.isSecret && !shownSecret ? 'password' : 'text'}
                  value={shownSecret ?? (variable.isSecret ? '' : (variable.value ?? ''))}
                  readOnly={Boolean(shownSecret)}
                  placeholder={
                    variable.isSecret
                      ? variable.hasSecret
                        ? '••••••••'
                        : t('api.studio.secretPlaceholder')
                      : t('api.studio.value')
                  }
                  className="h-7 font-mono text-xs"
                  onChange={(event) => {
                    if (shownSecret) return
                    if (!variable.isSecret)
                      onSet({ key: variable.key, value: event.target.value, isSecret: false })
                  }}
                  onBlur={(event) => {
                    const next = event.target.value
                    if (variable.isSecret && !next.trim()) return
                    if (!variable.isSecret && next === (variable.value ?? '')) return
                    onSet({ key: variable.key, value: next, isSecret: variable.isSecret })
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border p-2">
        <Input
          value={draftKey}
          onChange={(event) => setDraftKey(event.target.value)}
          placeholder={t('api.studio.key')}
          className="h-7 font-mono text-xs"
        />
        <Input
          type={draftSecret ? 'password' : 'text'}
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          placeholder={draftSecret ? t('api.studio.secretPlaceholder') : t('api.studio.value')}
          className="h-7 font-mono text-xs"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Checkbox
              id="api-variable-draft-secret"
              checked={draftSecret}
              disabled={!vaultAvailable}
              onCheckedChange={(checked) => setDraftSecret(checked === true)}
              className="size-3.5"
            />
            <label htmlFor="api-variable-draft-secret" className="cursor-pointer">
              {t('api.studio.secret')}
            </label>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!draftKey.trim()}
            onClick={() => {
              onSet({ key: draftKey.trim(), value: draftValue, isSecret: draftSecret })
              setDraftKey('')
              setDraftValue('')
              setDraftSecret(false)
            }}
          >
            <Plus className="size-3.5" />
            {t('api.studio.addVariable')}
          </Button>
        </div>
      </div>
    </div>
  )
}
