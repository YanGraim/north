import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { Button } from '@renderer/components/ui/button'
import { useDeleteAgentWorkspace } from '@renderer/hooks/use-agent-workspaces'
import { cn } from '@renderer/lib/utils'
import { openAgentWorkspaceSession, useSessionsStore } from '@renderer/stores/sessions-store'
import type { AgentWorkspace } from '@shared/types'
import { Bot, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type AgentWorkspaceCardProps = {
  workspace: AgentWorkspace
  onDragStart: (id: string) => void
}

export function AgentWorkspaceCard({
  workspace,
  onDragStart
}: AgentWorkspaceCardProps): React.JSX.Element {
  const { t } = useTranslation()
  const deleteWorkspace = useDeleteAgentWorkspace()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const hasSession = useSessionsStore((s) =>
    s.tabs.some((tab) => tab.agentWorkspaceId === workspace.id)
  )

  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', workspace.id)
        onDragStart(workspace.id)
      }}
      className="group flex flex-col gap-2 rounded-md border border-border bg-surface p-3 hover:bg-surface-elevated/40"
    >
      <div className="flex items-center gap-2">
        <Bot className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {workspace.repoName}
        </span>
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            hasSession ? 'bg-emerald-500' : 'bg-muted'
          )}
          title={hasSession ? t('agents.hasSession') : t('agents.noSession')}
        />
      </div>
      <span className="truncate font-mono text-[11px] text-muted">{workspace.branch}</span>
      {workspace.taskNote ? (
        <p className="line-clamp-2 text-xs text-muted">{workspace.taskNote}</p>
      ) : null}
      <div className="mt-1 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs"
          onClick={() => void openAgentWorkspaceSession(workspace)}
        >
          {t('agents.openSession')}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-destructive"
          title={t('agents.delete')}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('agents.deleteConfirmTitle')}
        description={t('agents.deleteConfirmDescription', { path: workspace.worktreePath })}
        confirming={deleteWorkspace.isPending}
        onConfirm={async () => {
          await deleteWorkspace.mutateAsync({ id: workspace.id })
          setConfirmDelete(false)
        }}
      />
    </li>
  )
}
