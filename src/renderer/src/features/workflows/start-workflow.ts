import { toastError } from '@renderer/lib/toast'
import { useSessionsStore } from '@renderer/stores/sessions-store'
import type { StartWorkflowRunInput, Workflow } from '@shared/types'

/**
 * Starts a workflow run and opens the workflow-run tab.
 * Shows input form via callback when the definition has inputs.
 */
export async function startWorkflowOnConnection(opts: {
  workflow: Workflow
  connectionId: string
  mode?: StartWorkflowRunInput['mode']
  inputValues?: StartWorkflowRunInput['inputValues']
}): Promise<void> {
  const { workflow, connectionId } = opts
  try {
    const run = await window.north.workflows.run({
      workflowId: workflow.id,
      mode: opts.mode ?? 'live',
      targets: [{ connectionId }],
      inputValues: opts.inputValues ?? {}
    })
    useSessionsStore.getState().openWorkflowRunTab({
      runId: run.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      connectionId
    })
  } catch (error) {
    toastError(error, 'Não foi possível executar o workflow')
    throw error
  }
}
