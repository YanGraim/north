import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { useEffect, useState } from 'react'

export type NameRequest = {
  title: string
  confirmLabel: string
  initial: string
  onSubmit: (name: string) => Promise<void>
}

/** Replaces `window.prompt`, which Electron doesn't implement (it always returns null). */
export function NameDialog({
  request,
  onClose
}: {
  request: NameRequest | null
  onClose: () => void
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (request) setValue(request.initial)
  }, [request])

  const name = value.trim()
  const invalid = !name || /[/\\]/.test(name) || name === '.' || name === '..'

  async function submit(): Promise<void> {
    if (!request || invalid || busy) return
    setBusy(true)
    try {
      await request.onSubmit(name)
      onClose()
    } catch {
      // onSubmit already toasted the error; keep the dialog open to fix the name.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm" data-testid="file-name-dialog">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Input
            autoFocus
            aria-label="Nome"
            className="font-mono"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => {
              // Select the name without the extension, like Finder/Explorer.
              const dot = e.target.value.lastIndexOf('.')
              e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length)
            }}
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={invalid || busy}>
              {request?.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
