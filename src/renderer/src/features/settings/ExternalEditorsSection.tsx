import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { toastWarning } from '@renderer/lib/toast'
import type { ExternalEditor } from '@shared/lib/remote-edit'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { externalEditorsQueryKey } from '../sessions/file-browser/use-remote-edits'

export function ExternalEditorsSection(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [executable, setExecutable] = useState('')
  const [saving, setSaving] = useState(false)
  const editors = useQuery({
    queryKey: externalEditorsQueryKey,
    queryFn: () => window.north.listExternalEditors()
  })
  const list = editors.data?.editors ?? []

  async function persist(next: ExternalEditor[]): Promise<boolean> {
    setSaving(true)
    try {
      const result = await window.north.saveExternalEditors({ editors: next })
      if (!result.ok) {
        toastWarning(
          t(
            result.reason === 'missing-executable'
              ? 'settings.externalEditors.missing'
              : 'settings.externalEditors.invalid'
          )
        )
        return false
      }
      await queryClient.invalidateQueries({ queryKey: externalEditorsQueryKey })
      return true
    } catch {
      toastWarning(t('settings.externalEditors.invalid'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function browse(): Promise<void> {
    try {
      const picked = await window.north.pickExecutable()
      if (picked) setExecutable(picked)
    } catch {
      toastWarning(t('settings.externalEditors.missing'))
    }
  }

  async function add(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed || !executable.trim()) return
    const added = await persist([
      ...list,
      { id: crypto.randomUUID(), name: trimmed, executable: executable.trim() }
    ])
    if (!added) return
    setName('')
    setExecutable('')
  }

  return (
    <section id="external-editors" className="space-y-3 scroll-mt-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">
          {t('settings.externalEditors.title')}
        </h2>
        <p className="mt-0.5 text-xs text-muted">{t('settings.externalEditors.description')}</p>
      </div>
      <div className="space-y-2" data-testid="settings-external-editors">
        {list.map((editor) => (
          <div key={editor.id} className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 truncate text-foreground">{editor.name}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
              {editor.executable}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => void persist(list.filter((item) => item.id !== editor.id))}
            >
              {t('settings.externalEditors.remove')}
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('settings.externalEditors.name')}
            aria-label={t('settings.externalEditors.name')}
            data-testid="settings-external-editor-name"
            className="w-40"
          />
          <Input
            value={executable}
            onChange={(event) => setExecutable(event.target.value)}
            placeholder={t('settings.externalEditors.executable')}
            aria-label={t('settings.externalEditors.executable')}
            data-testid="settings-external-editor-path"
            className="min-w-48 flex-1 font-mono text-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => void browse()}>
            {t('settings.externalEditors.browse')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || name.trim() === '' || executable.trim() === ''}
            data-testid="settings-external-editor-add"
            onClick={() => void add()}
          >
            {t('settings.externalEditors.add')}
          </Button>
        </div>
      </div>
    </section>
  )
}
