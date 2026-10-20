import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useCurrentWorkspace, useWorkspaces } from '@renderer/hooks/use-workspaces'
import { cn } from '@renderer/lib/utils'
import { stripWorkspacePrefix, workspacePath } from '@renderer/lib/workspace-paths'
import type { Workspace } from '@shared/types'
import { ChevronDown, Plus, User, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

function WorkspaceIcon({ workspace }: { workspace: Workspace | null }): React.JSX.Element {
  const Icon = workspace?.kind === 'organization' ? Users : User
  return <Icon className="size-3.5 shrink-0" aria-hidden />
}

/**
 * Titlebar pill + menu (Hoppscotch-style): personal workspace first, then the
 * organizations section with its own "+" (ADR 0018 §3).
 */
export function WorkspaceSwitcher(): React.JSX.Element {
  const { t } = useTranslation()
  const current = useCurrentWorkspace()
  const { data: workspaces = [] } = useWorkspaces()
  const navigate = useNavigate()
  const location = useLocation()
  const label = current ? workspaceLabel(current, t) : t('workspaces.title')
  const personal = workspaces.filter((w) => w.kind === 'local')
  const organizations = workspaces.filter((w) => w.kind === 'organization')
  const inOrganization = current?.kind === 'organization'

  const select = (id: string): void => {
    if (id === current?.id) return
    void navigate(workspacePath(id, stripWorkspacePrefix(location.pathname)))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="workspace-switcher"
        data-kind={current?.kind ?? 'local'}
        aria-label={`${t('workspaces.title')}: ${label}`}
        className={cn(
          'no-drag inline-flex h-7 max-w-44 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          inOrganization
            ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/15'
            : 'border-border text-foreground hover:bg-surface-elevated/60'
        )}
      >
        <WorkspaceIcon workspace={current} />
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuRadioGroup value={current?.id ?? ''} onValueChange={select}>
          {personal.map((workspace) => (
            <WorkspaceOption key={workspace.id} workspace={workspace} t={t} />
          ))}
          <DropdownMenuSeparator />
          <div className="flex items-center justify-between pr-1">
            <DropdownMenuLabel className="text-[11px] font-normal text-muted">
              {t('workspaces.organizations')}
            </DropdownMenuLabel>
            <button
              type="button"
              disabled
              aria-disabled="true"
              data-testid="workspace-add-organization"
              aria-label={`${t('workspaces.addOrganization')} (${t('workspaces.soon')})`}
              title={`${t('workspaces.addOrganization')} — ${t('workspaces.soon')}`}
              className="flex size-6 items-center justify-center rounded text-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
          {organizations.length === 0 ? (
            <p
              data-testid="workspace-organizations-empty"
              className="px-2 pb-2 text-[11px] text-muted"
            >
              {t('workspaces.organizationsEmpty')}
            </p>
          ) : (
            organizations.map((workspace) => (
              <WorkspaceOption key={workspace.id} workspace={workspace} t={t} />
            ))
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function WorkspaceOption({
  workspace,
  t
}: {
  workspace: Workspace
  t: (key: string) => string
}): React.JSX.Element {
  // Organizations stay listed but locked until the remote source exists (phase 2).
  const unavailable = workspace.kind !== 'local'
  return (
    <DropdownMenuRadioItem
      value={workspace.id}
      disabled={unavailable}
      data-testid={`workspace-option-${workspace.id}`}
      className="gap-2"
    >
      <WorkspaceIcon workspace={workspace} />
      <span className="min-w-0 flex-1 truncate">{workspaceLabel(workspace, t)}</span>
      {unavailable ? <span className="text-[11px] text-muted">{t('workspaces.soon')}</span> : null}
    </DropdownMenuRadioItem>
  )
}

/** The built-in local row is stored as "Pessoal"; show it in the UI language instead. */
function workspaceLabel(workspace: Workspace, t: (key: string) => string): string {
  return workspace.kind === 'local' ? t('workspaces.personal') : workspace.name
}
