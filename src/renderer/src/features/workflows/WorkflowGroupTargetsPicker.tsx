import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { cn } from '@renderer/lib/utils'
import { normalizeWorkflowName } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'

type WorkflowGroupTargetsPickerProps = {
  /** Group that owns the current workflow — excluded from selectable targets. */
  excludeGroupId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  className?: string
  /** Optional heading override. */
  title?: string
  /** Workflow name used to detect collisions in selected targets. */
  workflowName?: string
  /** When true, copy proceeds even if the name already exists in a target. */
  allowDuplicateNames?: boolean
  onAllowDuplicateNamesChange?: (allow: boolean) => void
  onConflictChange?: (hasConflict: boolean) => void
}

export function WorkflowGroupTargetsPicker({
  excludeGroupId,
  selectedIds,
  onChange,
  className,
  title = 'Grupos destino',
  workflowName,
  allowDuplicateNames = false,
  onAllowDuplicateNamesChange,
  onConflictChange
}: WorkflowGroupTargetsPickerProps): React.JSX.Element {
  const { groups, resolveGroup, isLoading } = useOrgLookup()
  const [conflictLabels, setConflictLabels] = useState<string[]>([])

  const options = useMemo(() => {
    return groups
      .filter((g) => g.id !== excludeGroupId)
      .map((g) => {
        const path = resolveGroup(g.id)
        const label = [path.client?.name, path.environment?.name, path.group?.name]
          .filter(Boolean)
          .join(' / ')
        return { id: g.id, label: label || g.name }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [groups, excludeGroupId, resolveGroup])

  const labelById = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options])

  useEffect(() => {
    const nameKey = workflowName ? normalizeWorkflowName(workflowName) : ''
    if (!nameKey || selectedIds.length === 0) {
      setConflictLabels([])
      return
    }

    let cancelled = false
    void (async () => {
      const labels: string[] = []
      for (const groupId of selectedIds) {
        try {
          const list = await window.north.workflows.list(groupId)
          if (list.some((w) => normalizeWorkflowName(w.name) === nameKey)) {
            labels.push(labelById.get(groupId) ?? groupId)
          }
        } catch {
          // ignore — main still enforces on copy
        }
      }
      if (!cancelled) {
        setConflictLabels(labels)
        onConflictChange?.(labels.length > 0)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedIds, workflowName, labelById, onConflictChange])

  useEffect(() => {
    if (selectedIds.length === 0 || !workflowName?.trim()) {
      onConflictChange?.(false)
    }
  }, [selectedIds, workflowName, onConflictChange])

  function toggle(id: string, checked: boolean): void {
    onChange(checked ? [...new Set([...selectedIds, id])] : selectedIds.filter((x) => x !== id))
  }

  const hasConflicts = conflictLabels.length > 0

  return (
    <fieldset
      className={cn('space-y-2 rounded-md border border-border px-3 py-2', className)}
      data-testid="workflow-group-targets"
    >
      <legend className="px-1 text-xs font-medium text-foreground">{title}</legend>
      <p className="text-xs text-muted">
        Cria cópias independentes (definition). Secrets da conexão não são copiados.
      </p>
      {isLoading ? <p className="text-xs text-muted">Carregando grupos…</p> : null}
      {!isLoading && options.length === 0 ? (
        <p className="text-xs text-muted">Nenhum outro grupo no inventário.</p>
      ) : null}
      <ul className="max-h-40 space-y-1 overflow-auto">
        {options.map((opt) => (
          <li key={opt.id}>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                data-testid={`workflow-group-target-${opt.id}`}
                checked={selectedIds.includes(opt.id)}
                onChange={(e) => toggle(opt.id, e.target.checked)}
              />
              <span className="min-w-0 break-words">{opt.label}</span>
            </label>
          </li>
        ))}
      </ul>

      {hasConflicts ? (
        <div
          className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2"
          data-testid="workflow-copy-name-conflict"
        >
          <p className="text-xs text-amber-200">
            Já existe um workflow chamado “{workflowName?.trim()}” em: {conflictLabels.join(', ')}.
          </p>
          {onAllowDuplicateNamesChange ? (
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                data-testid="workflow-copy-allow-duplicate"
                checked={allowDuplicateNames}
                onChange={(e) => onAllowDuplicateNamesChange(e.target.checked)}
              />
              Criar mesmo assim
            </label>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}
