import { queryKeys } from '@renderer/lib/query-keys'
import {
  LOCAL_WORKSPACE_ID,
  parseWorkspacePath,
  workspacePath
} from '@renderer/lib/workspace-paths'
import type { Workspace } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext } from 'react'
import { type NavigateOptions, useLocation, useNavigate } from 'react-router-dom'

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.list,
    queryFn: (): Promise<Workspace[]> => window.north.workspaces.list(),
    staleTime: Number.POSITIVE_INFINITY
  })
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
