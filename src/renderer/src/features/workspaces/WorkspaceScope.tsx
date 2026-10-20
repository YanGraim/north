import { AppShell } from '@renderer/components/layout/AppShell'
import { useWorkspaceHref, useWorkspaces, WorkspaceContext } from '@renderer/hooks/use-workspaces'
import { LOCAL_WORKSPACE_ID, workspacePath } from '@renderer/lib/workspace-paths'
import { useUiStore } from '@renderer/stores/ui-store'
import type { Workspace } from '@shared/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { toast } from 'sonner'

/**
 * One cache per workspace: switching never shows another workspace's rows and
 * every existing `queryKeys.*` / invalidation stays valid as-is (ADR 0018 §3).
 */
const workspaceClients = new Map<string, QueryClient>()

function clientFor(workspaceId: string): QueryClient {
  let client = workspaceClients.get(workspaceId)
  if (!client) {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
    })
    workspaceClients.set(workspaceId, client)
  }
  return client
}

/** Every workspace cache opened so far (tests / global refreshes). */
export function workspaceQueryClients(): QueryClient[] {
  return [...workspaceClients.values()]
}

type Activation =
  | { status: 'pending' }
  | { status: 'ready'; workspace: Workspace }
  | { status: 'failed' }

/** Route element for `/w/:workspaceId/*`: validates, activates in main, then renders the shell. */
export function WorkspaceScope(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { workspaceId = LOCAL_WORKSPACE_ID } = useParams()
  const location = useLocation()
  const { data: workspaces } = useWorkspaces()
  const setLastWorkspaceId = useUiStore((s) => s.setLastWorkspaceId)
  const [activation, setActivation] = useState<Activation>({ status: 'pending' })
  const known = workspaces?.find((w) => w.id === workspaceId)

  useEffect(() => {
    if (!known) return
    let cancelled = false
    setActivation({ status: 'pending' })
    window.north.workspaces.activate(known.id).then(
      (workspace) => {
        if (cancelled) return
        setLastWorkspaceId(workspace.id)
        setActivation({ status: 'ready', workspace })
      },
      () => {
        if (cancelled) return
        toast.error(t('workspaces.unavailable'))
        setActivation({ status: 'failed' })
      }
    )
    return () => {
      cancelled = true
    }
  }, [known, setLastWorkspaceId, t])

  if (!workspaces) return null

  const innerPath = location.pathname.replace(/^\/w\/[^/]+/, '') || '/'
  const fallback = workspacePath(
    LOCAL_WORKSPACE_ID,
    `${innerPath}${location.search}${location.hash}`
  )

  if (!known || activation.status === 'failed') {
    if (workspaceId === LOCAL_WORKSPACE_ID) return null
    return <Navigate to={fallback} replace />
  }
  if (activation.status !== 'ready' || activation.workspace.id !== workspaceId) return null

  return (
    <WorkspaceContext.Provider value={activation.workspace}>
      <QueryClientProvider client={clientFor(workspaceId)}>
        <AppShell />
      </QueryClientProvider>
    </WorkspaceContext.Provider>
  )
}

/** Pre-workspace routes (`/connections`, bookmarks, old deep links) → `/w/<last>/…`. */
export function LegacyRouteRedirect(): React.JSX.Element {
  const location = useLocation()
  const lastWorkspaceId = useUiStore((s) => s.lastWorkspaceId)
  const { data: workspaces } = useWorkspaces()
  const target =
    lastWorkspaceId && workspaces?.some((w) => w.id === lastWorkspaceId)
      ? lastWorkspaceId
      : LOCAL_WORKSPACE_ID
  return (
    <Navigate
      to={workspacePath(target, `${location.pathname}${location.search}${location.hash}`)}
      replace
    />
  )
}

export function ScopedRedirect({ to }: { to: string }): React.JSX.Element {
  const href = useWorkspaceHref()
  const location = useLocation()
  return <Navigate to={`${href(to)}${location.search}`} replace />
}
