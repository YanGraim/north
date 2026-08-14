import { Button } from '@renderer/components/ui/button'
import { DetailSection } from '@renderer/features/connections/DetailSection'
import { startWorkflowOnConnection } from '@renderer/features/workflows/start-workflow'
import { WorkflowHubDialog } from '@renderer/features/workflows/WorkflowHubDialog'
import { WorkflowInputsDialog } from '@renderer/features/workflows/WorkflowInputsDialog'
import { useWorkflows } from '@renderer/hooks/use-workflows'
import type { Workflow } from '@shared/types'
import { Pencil, Play, Plus, Workflow as WorkflowIcon } from 'lucide-react'
import { useState } from 'react'

type WorkflowSectionProps = {
  groupId: string
  connectionId: string
  connectionProtocol: string
}

type HubIntent = {
  open: boolean
  workflowId: string | null
  createMode: boolean
}

export function WorkflowSection({
  groupId,
  connectionId,
  connectionProtocol
}: WorkflowSectionProps): React.JSX.Element {
  const { data: workflows = [], isLoading } = useWorkflows(groupId)
  const [hub, setHub] = useState<HubIntent>({ open: false, workflowId: null, createMode: false })
  const [pendingWorkflow, setPendingWorkflow] = useState<Workflow | null>(null)
  const sshOk = connectionProtocol === 'ssh'

  async function handleRun(workflow: Workflow): Promise<void> {
    if (!sshOk) return
    if (workflow.definition.inputs.length > 0) {
      setPendingWorkflow(workflow)
      return
    }
    await startWorkflowOnConnection({ workflow, connectionId })
  }

  function openCreate(): void {
    setHub({ open: true, workflowId: null, createMode: true })
  }

  function openEdit(workflow: Workflow): void {
    setHub({ open: true, workflowId: workflow.id, createMode: false })
  }

  function openManage(): void {
    setHub({ open: true, workflowId: null, createMode: false })
  }

  return (
    <>
      <DetailSection
        title="Workflows"
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            data-testid="workflow-section-new"
            onClick={() => openCreate()}
          >
            <Plus className="mr-1 size-3.5" />
            Novo
          </Button>
        }
      >
        <div data-testid="workflow-section" className="min-w-0 space-y-1.5">
          {isLoading ? (
            <p className="text-sm text-muted">Carregando…</p>
          ) : workflows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
              <WorkflowIcon className="mx-auto mb-2 size-5 text-muted" />
              <p className="text-sm text-muted">Nenhum workflow neste grupo.</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-auto p-0 text-accent"
                onClick={() => openCreate()}
              >
                Criar workflow…
              </Button>
            </div>
          ) : (
            <ul className="min-w-0 space-y-1">
              {workflows.map((workflow) => (
                <li
                  key={workflow.id}
                  className="flex min-w-0 items-center gap-0.5 rounded-md px-1 py-0.5 hover:bg-surface"
                >
                  <button
                    type="button"
                    data-testid={`workflow-item-${workflow.id}`}
                    className="min-w-0 flex-1 truncate px-1 py-1 text-left text-sm text-foreground"
                    onClick={() => openEdit(workflow)}
                  >
                    {workflow.name}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={!sshOk}
                    data-testid={`workflow-run-${workflow.id}`}
                    aria-label={`Executar ${workflow.name}`}
                    onClick={() => void handleRun(workflow)}
                  >
                    <Play className="size-3.5 text-accent" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    data-testid={`workflow-edit-${workflow.id}`}
                    aria-label={`Editar ${workflow.name}`}
                    onClick={() => openEdit(workflow)}
                  >
                    <Pencil className="size-3.5 text-muted" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {workflows.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-accent"
              data-testid="workflow-section-manage"
              onClick={() => openManage()}
            >
              Gerenciar workflows…
            </Button>
          ) : null}
          {!sshOk ? (
            <p className="px-2 text-xs text-muted">Workflows MVP exigem conexão SSH.</p>
          ) : null}
        </div>
      </DetailSection>

      <WorkflowHubDialog
        groupId={groupId}
        open={hub.open}
        onOpenChange={(open) => {
          if (!open) setHub({ open: false, workflowId: null, createMode: false })
          else setHub((prev) => ({ ...prev, open: true }))
        }}
        initialWorkflowId={hub.workflowId}
        startInCreateMode={hub.createMode}
      />

      {pendingWorkflow ? (
        <WorkflowInputsDialog
          workflow={pendingWorkflow}
          open={Boolean(pendingWorkflow)}
          onOpenChange={(open) => {
            if (!open) setPendingWorkflow(null)
          }}
          onConfirm={async (inputValues) => {
            const workflow = pendingWorkflow
            setPendingWorkflow(null)
            await startWorkflowOnConnection({
              workflow,
              connectionId,
              inputValues
            })
          }}
        />
      ) : null}
    </>
  )
}
