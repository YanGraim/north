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
import { toastError } from '@renderer/lib/toast'
import type { Workflow, WorkflowInput } from '@shared/types'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type WorkflowInputsDialogProps = {
  workflow: Workflow
  /** Connection the workflow will run on — needed to fetch live git-tag options. */
  connectionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (values: Record<string, string | boolean>) => Promise<void>
}

export function WorkflowInputsDialog({
  workflow,
  connectionId,
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
  const [liveOptions, setLiveOptions] = useState<Record<string, WorkflowInput['options']>>({})
  const [loadingTags, setLoadingTags] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    for (const input of workflow.definition.inputs) {
      if (input.type !== 'select' || !input.gitTagsSource) continue
      const repositoryPath = input.gitTagsSource.repositoryPath
      setLoadingTags((prev) => new Set(prev).add(input.key))
      window.north.workflows
        .listGitTags(connectionId, repositoryPath)
        .then((tags) => {
          setLiveOptions((prev) => ({
            ...prev,
            [input.key]: tags.map((tag) => ({ label: tag, value: tag }))
          }))
        })
        .catch((error) => {
          toastError(error, `Não foi possível listar as tags de "${input.label}"`)
        })
        .finally(() => {
          setLoadingTags((prev) => {
            const next = new Set(prev)
            next.delete(input.key)
            return next
          })
        })
    }
    // Only re-fetch when the dialog (re)opens for a given workflow/connection.
  }, [open, workflow.id, connectionId])

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
                <div className="space-y-1">
                  <Select
                    value={String(values[input.key] ?? '')}
                    onValueChange={(v) => setValues((prev) => ({ ...prev, [input.key]: v }))}
                    disabled={loadingTags.has(input.key)}
                  >
                    <SelectTrigger id={`wf-input-${input.key}`}>
                      <SelectValue
                        placeholder={loadingTags.has(input.key) ? 'Buscando tags…' : 'Selecione…'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {((input.gitTagsSource ? liveOptions[input.key] : input.options) ?? []).map(
                        (opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  {loadingTags.has(input.key) ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <Loader2 className="size-3 animate-spin" />
                      Rodando git fetch --tags no servidor…
                    </p>
                  ) : input.gitTagsSource && (liveOptions[input.key]?.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted">Nenhuma tag encontrada nesse repositório.</p>
                  ) : null}
                </div>
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
