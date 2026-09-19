import { Skeleton } from '@renderer/components/ui/skeleton'
import { useAgentWorkspaces } from '@renderer/hooks/use-agent-workspaces'
import { cn } from '@renderer/lib/utils'
import { openAgentWorkspaceSession, useSessionsStore } from '@renderer/stores/sessions-store'
import { Bot, LayoutGrid } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavItem } from './NavItem'

const ROW =
  'flex h-8 min-w-0 w-full items-center gap-1.5 rounded-md px-2 text-[13px] text-muted transition-colors motion-safe:duration-150 hover:bg-surface-elevated/40 hover:text-foreground'

type AgentWorkspacesListProps = {
  collapsed: boolean
}

export function AgentWorkspacesList({ collapsed }: AgentWorkspacesListProps): React.JSX.Element {
  const { t } = useTranslation()
  const { data: workspaces = [], isLoading } = useAgentWorkspaces()
  const tabs = useSessionsStore((s) => s.tabs)
  const openWorkspaceIds = useMemo(
    () => new Set(tabs.filter((tab) => tab.agentWorkspaceId).map((tab) => tab.agentWorkspaceId)),
    [tabs]
  )
  if (collapsed) {
    return <NavItem to="/agents" label={t('nav.agents')} icon={LayoutGrid} collapsed plain />
  }

  return (
    <div className="flex flex-col gap-0.5 px-1">
      <NavItem to="/agents" label={t('agents.title')} icon={LayoutGrid} />
      {isLoading ? (
        <div className="px-1 pt-1">
          <Skeleton className="h-8 w-full" />
        </div>
      ) : workspaces.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted">{t('agents.empty')}</p>
      ) : null}
      {workspaces.map((workspace) => {
        const hasSession = openWorkspaceIds.has(workspace.id)
        return (
          <button
            key={workspace.id}
            type="button"
            className={ROW}
            onClick={() => void openAgentWorkspaceSession(workspace)}
          >
            <Bot className="size-3.5 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-left">
              {workspace.repoName} · {workspace.branch}
            </span>
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                hasSession ? 'bg-emerald-500' : 'bg-muted'
              )}
              title={hasSession ? t('agents.hasSession') : t('agents.noSession')}
            />
          </button>
        )
      })}
    </div>
  )
}
