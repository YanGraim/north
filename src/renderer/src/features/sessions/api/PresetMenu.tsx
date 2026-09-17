import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Input } from '@renderer/components/ui/input'
import type { ApiPreset } from '@shared/types'
import { ChevronDown, Save } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type PresetMenuProps = {
  presets: ApiPreset[]
  /** Which slice of a preset is relevant here — headers presets vs auth presets. */
  kind: 'headers' | 'auth'
  onApply: (preset: ApiPreset) => void
  onSave: (name: string) => void
}

export function PresetMenu({ presets, kind, onApply, onSave }: PresetMenuProps): React.JSX.Element {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')

  const applicable = presets.filter((preset) =>
    kind === 'headers' ? preset.headers.length > 0 : preset.auth !== null
  )

  function handleSave(): void {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
    setName('')
    setDialogOpen(false)
  }

  return (
    <div className="flex items-center gap-1 pb-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-muted"
          >
            {t('api.studio.applyPreset')}
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {applicable.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted">{t('api.studio.noPresets')}</div>
          ) : (
            applicable.map((preset) => (
              <DropdownMenuItem key={preset.id} onSelect={() => onApply(preset)}>
                {preset.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs text-muted"
        onClick={() => setDialogOpen(true)}
      >
        <Save className="size-3" />
        {t('api.studio.saveAsPreset')}
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('api.studio.saveAsPreset')}</DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('api.studio.presetNamePlaceholder')}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSave()
            }}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleSave}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
