import { queryKeys } from '@renderer/lib/query-keys'
import {
  LOCAL_WORKSPACE_ID,
  parseWorkspacePath,
  workspacePath
} from '@renderer/lib/workspace-paths'
import type { AddOrganizationInput, Workspace } from '@shared/types'
import { type QueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext } from 'react'
import { type NavigateOptions, useLocation, useNavigate } from 'react-router-dom'

/**
 * The app-level cache (outside every workspace's own cache). The workspace
 * list lives here so the switcher and `WorkspaceScope` always agree.
 */
export const RootQueryClientContext = createContext<QueryClient | null>(null)

export function useWorkspaces() {
  const root = useContext(RootQueryClientContext) ?? undefined
  return useQuery(
    {
      queryKey: queryKeys.workspaces.list,
      queryFn: (): Promise<Workspace[]> => window.north.workspaces.list(),
      staleTime: Number.POSITIVE_INFINITY
    },
    root
  )
}

export function useAddOrganization() {
  const root = useContext(RootQueryClientContext) ?? undefined
  return useMutation(
    {
      mutationFn: (input: AddOrganizationInput) => window.north.workspaces.addOrganization(input),
      onSuccess: () => root?.invalidateQueries({ queryKey: queryKeys.workspaces.list })
    },
    root
  )
}

export function useRemoveOrganization() {
  const root = useContext(RootQueryClientContext) ?? undefined
  return useMutation(
    {
      mutationFn: (id: string) => window.north.workspaces.remove(id),
      onSuccess: () => root?.invalidateQueries({ queryKey: queryKeys.workspaces.list })
    },
    root
  )
}

export const WorkspaceContext = createContext<Workspace | null>(null)

/** Current workspace id: from `WorkspaceScope`, else the URL, else local. */
export function useWorkspaceId(): string {
  const workspace = useContext(WorkspaceContext)
  const location = useLocation()
  return workspace?.id ?? parseWorkspacePath(location.pathname)?.workspaceId ?? LOCAL_WORKSPACE_ID
}

export function useCurrentWorkspace(): Workspace | null {
  return useContext(WorkspaceContext)
}

/** `href('/connections')` → `/w/<current>/connections`. */
export function useWorkspaceHref(): (path: string) => string {
  const workspaceId = useWorkspaceId()
  return useCallback((path: string) => workspacePath(workspaceId, path), [workspaceId])
}

/** `useNavigate()` that keeps absolute string paths inside the current workspace. */
export function useWorkspaceNavigate(): (to: string, options?: NavigateOptions) => void {
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  return useCallback(
    (to: string, options?: NavigateOptions) => {
      void navigate(to.startsWith('/') ? href(to) : to, options)
    },
    [navigate, href]
  )
}
