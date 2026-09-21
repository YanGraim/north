import { DetailSection } from '@renderer/features/connections/DetailSection'
import { useEnvironmentUpdates } from '@renderer/hooks/use-environment-updates'
import { useWorkflow } from '@renderer/hooks/use-workflows'
import { formatRelativeDate } from '@renderer/lib/connection-ui'
import { UpdatesChart } from '@renderer/lib/environment-updates-chart'
import { cn } from '@renderer/lib/utils'
import type { EnvironmentUpdate } from '@shared/types'
import { CheckCircle2, ChevronDown, XCircle } from 'lucide-react'

type EnvironmentUpdatesSectionProps = {
  environmentId: string | null
}

export function WorkflowName({ workflowId }: { workflowId: string }): React.JSX.Element {
  const { data: workflow } = useWorkflow(workflowId)
  return <>{workflow?.name ?? 'Workflow'}</>
}

export function UpdateRow({
  update,
  contextLabel
}: {
  update: EnvironmentUpdate
  /** Extra context shown before the workflow name — e.g. "Cliente · Ambiente" on a cross-environment feed. */
  contextLabel?: React.ReactNode
}): React.JSX.Element {
  const success = update.status === 'success'
  return (
    <details className="group rounded-md border border-border">
      <summary className="flex cursor-pointer list-none flex-col gap-0.5 px-2.5 py-2 text-xs">
        <span className="flex items-center gap-2">
          {success ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <XCircle className="size-3.5 shrink-0 text-red-500" aria-hidden />
          )}
          <span className="shrink-0 text-muted">{formatRelativeDate(update.startedAt)}</span>
          <span className="shrink-0 truncate font-mono text-foreground">
            {update.currentCommit.slice(0, 7)}
          </span>
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted transition-transform group-open:rotate-180" />
        </span>
        <span className="truncate pl-5 text-muted">
          {contextLabel ? <>{contextLabel} · </> : null}
          <WorkflowName workflowId={update.workflowId} /> · {update.commits.length} commit
          {update.commits.length === 1 ? '' : 's'} · {update.filesChanged} arquivo(s)
        </span>
      </summary>
      <div className="space-y-2 border-t border-border px-2.5 py-2 text-xs">
        <p className="font-mono text-muted">
          {update.previousCommit.slice(0, 7)} → {update.currentCommit.slice(0, 7)} · {update.branch}
        </p>
        {update.commits.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5 text-foreground">
            {update.commits.map((commit) => (
              <li key={commit.hash} className="truncate">
                <span className="font-mono text-muted">{commit.hash.slice(0, 7)}</span>{' '}
                {commit.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  )
}

export function EnvironmentUpdatesSection({
  environmentId
}: EnvironmentUpdatesSectionProps): React.JSX.Element | null {
  const { data: updates = [] } = useEnvironmentUpdates(environmentId)

  if (updates.length === 0) return null

  const successCount = updates.filter((u) => u.status === 'success').length
  const successRate = Math.round((successCount / updates.length) * 100)
  const last = updates[0]

  return (
    <DetailSection title="Atualizações">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <span className="font-medium text-foreground">{updates.length}</span> atualizaç
          {updates.length === 1 ? 'ão' : 'ões'}
        </span>
        <span>
          <span
            className={cn(
              'font-medium',
              successRate >= 80 ? 'text-emerald-500' : 'text-foreground'
            )}
          >
            {successRate}%
          </span>{' '}
          de sucesso
        </span>
        {last ? <span>última {formatRelativeDate(last.startedAt)}</span> : null}
      </div>
      <UpdatesChart updates={updates} />
      <ul className="space-y-1.5">
        {updates.slice(0, 20).map((update) => (
          <li key={update.id}>
            <UpdateRow update={update} />
          </li>
        ))}
      </ul>
    </DetailSection>
  )
}
