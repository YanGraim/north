import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  useCurrentWorkspace,
  useRemoveOrganization,
  useWorkspaces
} from '@renderer/hooks/use-workspaces'
import { formatIpcError } from '@renderer/lib/ipc-error'
import { cn } from '@renderer/lib/utils'
import {
  LOCAL_WORKSPACE_ID,
  stripWorkspacePrefix,
  workspacePath
} from '@renderer/lib/workspace-paths'
import type { Workspace } from '@shared/types'
import { ChevronDown, LogOut, Plus, User, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AddOrganizationDialog } from './AddOrganizationDialog'

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
  const [adding, setAdding] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const remove = useRemoveOrganization()

  const leave = async (): Promise<void> => {
    if (!current || current.kind !== 'organization') return
    try {
      await remove.mutateAsync(current.id)
      setLeaving(false)
      void navigate(workspacePath(LOCAL_WORKSPACE_ID, '/dashboard'))
    } catch (error) {
      toast.error(formatIpcError(error))
    }
  }

  const select = (id: string): void => {
    if (id === current?.id) return
    void navigate(workspacePath(id, stripWorkspacePrefix(location.pathname)))
  }

  return (
    <>
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
              <DropdownMenuItem
                data-testid="workspace-add-organization"
                aria-label={t('workspaces.addOrganization')}
                title={t('workspaces.addOrganization')}
                onSelect={() => setAdding(true)}
                className="size-6 justify-center p-0 text-muted"
              >
                <Plus className="size-3.5" aria-hidden />
              </DropdownMenuItem>
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
          {inOrganization ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="workspace-leave"
                onSelect={() => setLeaving(true)}
                className="gap-2 text-muted"
              >
                <LogOut className="size-3.5" aria-hidden />
                {t('workspaces.leave')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AddOrganizationDialog open={adding} onOpenChange={setAdding} />
      <AlertDialog open={leaving} onOpenChange={setLeaving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('workspaces.leaveTitle', { name: current?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('workspaces.leaveBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t('workspaces.leaveCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault()
                void leave()
              }}
            >
              {t('workspaces.leaveConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function WorkspaceOption({
  workspace,
  t
}: {
  workspace: Workspace
  t: (key: string) => string
}): React.JSX.Element {
  return (
    <DropdownMenuRadioItem
      value={workspace.id}
      data-testid={`workspace-option-${workspace.id}`}
      className="gap-2"
    >
      <WorkspaceIcon workspace={workspace} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{workspaceLabel(workspace, t)}</span>
        {workspace.userEmail ? (
          <span className="truncate text-[11px] text-muted">{workspace.userEmail}</span>
        ) : null}
      </span>
    </DropdownMenuRadioItem>
  )
}

/** The built-in local row is stored as "Pessoal"; show it in the UI language instead. */
function workspaceLabel(workspace: Workspace, t: (key: string) => string): string {
  return workspace.kind === 'local' ? t('workspaces.personal') : workspace.name
}
