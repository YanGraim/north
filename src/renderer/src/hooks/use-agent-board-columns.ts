import { queryKeys } from '@renderer/lib/query-keys'
import { toastError } from '@renderer/lib/toast'
import type {
  AgentBoardColumn,
  CreateAgentBoardColumnInput,
  UpdateAgentBoardColumnInput
} from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

export function useAgentBoardColumns(): UseQueryResult<AgentBoardColumn[], Error> {
  return useQuery({
    queryKey: queryKeys.agentBoardColumns.list(),
    queryFn: () => window.north.agentBoardColumns.list()
  })
}

export function useCreateAgentBoardColumn(): UseMutationResult<
  AgentBoardColumn,
  Error,
  CreateAgentBoardColumnInput
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.agentBoardColumns.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentBoardColumns.list() })
    },
    onError: (error) => toastError(error, t('agents.createColumnError'))
  })
}

export function useUpdateAgentBoardColumn(): UseMutationResult<
  AgentBoardColumn,
  Error,
  { id: string; input: UpdateAgentBoardColumnInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.agentBoardColumns.update(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentBoardColumns.list() })
    }
  })
}

export function useDeleteAgentBoardColumn(): UseMutationResult<void, Error, { id: string }> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => window.north.agentBoardColumns.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentBoardColumns.list() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentWorkspaces.list() })
    },
    onError: (error) => toastError(error, t('agents.deleteColumnError'))
  })
}
