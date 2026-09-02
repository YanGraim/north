import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useClients } from '@renderer/hooks/use-clients'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const GLOBAL_VALUE = '__global__'

type NameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  defaultValue?: string
  showName?: boolean
  showScope?: boolean
  confirmLabel?: string
  onSubmit: (input: { name: string; clientId: string | null }) => void
}

export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultValue = '',
  showName = true,
  showScope = false,
  confirmLabel,
  onSubmit
}: NameDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const { data: clients = [] } = useClients()
  const [name, setName] = useState(defaultValue)
  const [scope, setScope] = useState(GLOBAL_VALUE)

  useEffect(() => {
    if (!open) return
    setName(defaultValue)
    setScope(GLOBAL_VALUE)
  }, [defaultValue, open])

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    const trimmed = name.trim()
    if (showName && !trimmed) return
    onSubmit({
      name: trimmed,
      clientId: showScope && scope !== GLOBAL_VALUE ? scope : null
    })
    onOpenChange(false)
  }

  const canSubmit = !showName || name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {showName ? (
            <div className="grid gap-1.5">
              <Label htmlFor="north-name-dialog">{t('api.dialogs.name')}</Label>
              <Input
                id="north-name-dialog"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
          ) : null}
          {showScope ? (
            <div className="grid gap-1.5">
              <Label>{t('api.scope.label')}</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GLOBAL_VALUE}>{t('api.scope.global')}</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {confirmLabel ?? t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
