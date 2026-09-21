import { queryKeys } from '@renderer/lib/query-keys'
import { toastError } from '@renderer/lib/toast'
import type {
  AgentWorkspace,
  AgentWorkspaceBranchStatus,
  CreateAgentWorkspaceInput,
  UpdateAgentWorkspaceInput
} from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

export function useAgentWorkspaces(): UseQueryResult<AgentWorkspace[], Error> {
  return useQuery({
    queryKey: queryKeys.agentWorkspaces.list(),
    queryFn: () => window.north.agentWorkspaces.list()
  })
}

export function useCreateAgentWorkspace(): UseMutationResult<
  AgentWorkspace,
  Error,
  CreateAgentWorkspaceInput
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.agentWorkspaces.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentWorkspaces.list() })
    },
    onError: (error) => toastError(error, t('agents.createError'))
  })
}

export function useUpdateAgentWorkspace(): UseMutationResult<
  AgentWorkspace,
  Error,
  { id: string; input: UpdateAgentWorkspaceInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.agentWorkspaces.update(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentWorkspaces.list() })
    }
  })
}

export function useDeleteAgentWorkspace(): UseMutationResult<void, Error, { id: string }> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => window.north.agentWorkspaces.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentWorkspaces.list() })
    },
    onError: (error) => toastError(error, t('agents.deleteError'))
  })
}

export async function pickAgentWorkspaceRepo(): Promise<string | null> {
  return window.north.agentWorkspaces.pickRepo()
}

/** Whether `branch` exists locally in `repoPath`, and if it's in use elsewhere. */
export async function checkAgentWorkspaceBranchExists(
  repoPath: string,
  branch: string
): Promise<AgentWorkspaceBranchStatus> {
  return window.north.agentWorkspaces.checkBranch(repoPath, branch)
}
