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
import type { Workflow } from '@shared/types'
import { useState } from 'react'

type WorkflowInputsDialogProps = {
  workflow: Workflow
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (values: Record<string, string | boolean>) => Promise<void>
}

export function WorkflowInputsDialog({
  workflow,
  open,
  onOpenChange,
  onConfirm
}: WorkflowInputsDialogProps): React.JSX.Element {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {}
    for (const input of workflow.definition.inputs) {
      if (input.default !== undefined) {
        initial[input.key] = input.default
      } else if (input.type === 'boolean') {
        initial[input.key] = false
      } else {
        initial[input.key] = ''
      }
    }
    return initial
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(): Promise<void> {
    for (const input of workflow.definition.inputs) {
      if (!input.required) continue
      const value = values[input.key]
      if (value === undefined || value === '') {
        return
      }
    }
    setSubmitting(true)
    try {
      await onConfirm(values)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="workflow-inputs-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Parâmetros — {workflow.name}</DialogTitle>
          <DialogDescription>Preencha os inputs antes de executar o workflow.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {workflow.definition.inputs.map((input) => (
            <div key={input.id} className="space-y-1.5">
              <Label htmlFor={`wf-input-${input.key}`}>
                {input.label}
                {input.required ? ' *' : ''}
              </Label>
              {input.type === 'select' ? (
                <Select
                  value={String(values[input.key] ?? '')}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, [input.key]: v }))}
                >
                  <SelectTrigger id={`wf-input-${input.key}`}>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(input.options ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : input.type === 'boolean' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    id={`wf-input-${input.key}`}
                    type="checkbox"
                    checked={Boolean(values[input.key])}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [input.key]: e.target.checked }))
                    }
                  />
                  Ativo
                </label>
              ) : (
                <Input
                  id={`wf-input-${input.key}`}
                  data-testid={`workflow-input-${input.key}`}
                  value={String(values[input.key] ?? '')}
                  onChange={(e) => setValues((prev) => ({ ...prev, [input.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            data-testid="workflow-inputs-confirm"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            Executar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
