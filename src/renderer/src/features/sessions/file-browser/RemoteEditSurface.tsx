import { Button } from '@renderer/components/ui/button'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RemoteFileEditor } from './RemoteFileEditor'
import type { RemoteEditTab } from './use-remote-edits'

type RemoteEditSurfaceProps = {
  tabs: RemoteEditTab[]
  activeId: string | null
  onActivate: (editId: string) => void
  onChange: (editId: string, content: string) => void
  onSave: (editId: string) => void
  onClose: (editId: string) => void
}

export function RemoteEditSurface({
  tabs,
  activeId,
  onActivate,
  onChange,
  onSave,
  onClose
}: RemoteEditSurfaceProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const active = tabs.find((tab) => tab.editId === activeId) ?? tabs[0]
  if (!active) return null
  const dirty = active.content !== active.savedContent

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background" data-testid="remote-edit">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist">
          {tabs.map((tab) => {
            const selected = tab.editId === active.editId
            const tabDirty = tab.content !== tab.savedContent
            return (
              <div key={tab.editId} className="flex shrink-0 items-center">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  data-testid="remote-edit-tab"
                  data-dirty={tabDirty ? 'true' : 'false'}
                  title={tab.remotePath}
                  className={
                    selected
                      ? 'max-w-72 truncate rounded-sm bg-surface px-2 py-1 font-mono text-xs text-foreground'
                      : 'max-w-72 truncate rounded-sm px-2 py-1 font-mono text-xs text-muted hover:text-foreground'
                  }
                  onClick={() => onActivate(tab.editId)}
                >
                  {tabDirty ? '● ' : ''}
                  {tab.remotePath}
                </button>
                <button
                  type="button"
                  className="rounded-sm p-1 text-muted hover:text-foreground"
                  aria-label={t('connection.fileBrowser.closeEdit')}
                  data-testid="remote-edit-close"
                  onClick={() => onClose(tab.editId)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            )
          })}
        </div>
        <Button
          type="button"
          size="sm"
          data-testid="remote-edit-save"
          disabled={!dirty || active.saving}
          onClick={() => onSave(active.editId)}
        >
          {t('connection.fileBrowser.save')}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <RemoteFileEditor
          key={active.editId}
          value={active.content}
          onChange={(content) => onChange(active.editId, content)}
          onSave={() => onSave(active.editId)}
        />
      </div>
    </div>
  )
}
