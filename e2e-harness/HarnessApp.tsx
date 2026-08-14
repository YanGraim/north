import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ConnectionSecretsSection } from '@renderer/features/workflows/ConnectionSecretsSection'
import { startWorkflowOnConnection } from '@renderer/features/workflows/start-workflow'
import { WorkflowHubDialog } from '@renderer/features/workflows/WorkflowHubDialog'
import { WorkflowInputsDialog } from '@renderer/features/workflows/WorkflowInputsDialog'
import { WorkflowRunView } from '@renderer/features/workflows/WorkflowRunView'
import { WorkflowSection } from '@renderer/features/workflows/WorkflowSection'
import { useWorkflows } from '@renderer/hooks/use-workflows'
import { type SessionTab, useSessionsStore } from '@renderer/stores/sessions-store'
import type { Workflow } from '@shared/types'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { harnessIds } from './mock-north'

export function HarnessApp(): React.JSX.Element {
  const [hubOpen, setHubOpen] = useState(false)
  const [pendingWorkflow, setPendingWorkflow] = useState<Workflow | null>(null)
  const { data: workflows = [] } = useWorkflows(harnessIds.GROUP_ID)
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const runTab = tabs.find((t) => t.kind === 'workflow-run' && t.id === activeTabId) as
    | SessionTab
    | undefined

  async function runWorkflow(workflow: Workflow): Promise<void> {
    if (workflow.definition.inputs.length > 0) {
      setPendingWorkflow(workflow)
      return
    }
    await startWorkflowOnConnection({
      workflow,
      connectionId: harnessIds.CONNECTION_ID
    })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <h1 className="text-lg font-medium">North Workflows E2E</h1>
        <div className="flex gap-2">
          {tabs
            .filter((t) => t.kind === 'workflow-run')
            .map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={activeTabId === tab.id ? 'default' : 'secondary'}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.title}
              </Button>
            ))}
        </div>
      </header>

      {runTab ? (
        <div className="h-[560px] overflow-hidden rounded-md border border-border">
          <WorkflowRunView tab={runTab} />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <section
            className="rounded-md border border-border p-4"
            data-testid="e2e-connection-card"
          >
            <h2 className="mb-2 text-sm font-medium">web-01</h2>
            <p className="mb-3 text-xs text-muted">10.0.0.10 · ssh</p>
            <div className="mb-4 flex">
              <Button
                type="button"
                size="sm"
                className="rounded-r-none"
                data-testid="connect-button"
                onClick={() => {
                  const el = document.createElement('div')
                  el.setAttribute('data-testid', 'connecting-state')
                  el.textContent = 'Conectando…'
                  document.body.appendChild(el)
                }}
              >
                Conectar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-l-none border-l border-l-background/20 px-2"
                    data-testid="connect-split-chevron"
                    aria-label="Workflows"
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" data-testid="connect-split-menu">
                  {workflows.map((workflow) => (
                    <DropdownMenuItem key={workflow.id} onSelect={() => void runWorkflow(workflow)}>
                      {workflow.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="connect-split-manage"
                    onSelect={() => setHubOpen(true)}
                  >
                    Gerenciar workflows…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <WorkflowSection
              groupId={harnessIds.GROUP_ID}
              connectionId={harnessIds.CONNECTION_ID}
              connectionProtocol="ssh"
            />

            <div className="mt-4">
              <ConnectionSecretsSection connectionId={harnessIds.CONNECTION_ID} />
            </div>
          </section>
        </div>
      )}

      <WorkflowHubDialog groupId={harnessIds.GROUP_ID} open={hubOpen} onOpenChange={setHubOpen} />

      {pendingWorkflow ? (
        <WorkflowInputsDialog
          workflow={pendingWorkflow}
          open
          onOpenChange={(open) => {
            if (!open) setPendingWorkflow(null)
          }}
          onConfirm={async (inputValues) => {
            const workflow = pendingWorkflow
            setPendingWorkflow(null)
            await startWorkflowOnConnection({
              workflow,
              connectionId: harnessIds.CONNECTION_ID,
              inputValues
            })
          }}
        />
      ) : null}
    </div>
  )
}
