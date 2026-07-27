import { invalidateSearchIndex } from '@renderer/lib/invalidate-inventory'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type { CreateEnvironmentInput, Environment, UpdateEnvironmentInput } from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useEnvironments(clientId?: string): UseQueryResult<Environment[], Error> {
  return useQuery({
    queryKey: queryKeys.environments.byClient(clientId),
    queryFn: () => window.north.environments.list(clientId)
  })
}

export function useEnvironment(id: string | undefined): UseQueryResult<Environment | null, Error> {
  return useQuery({
    queryKey: queryKeys.environments.detail(id ?? ''),
    queryFn: () => window.north.environments.get(id as string),
    enabled: Boolean(id)
  })
}

export function useCreateEnvironment(): UseMutationResult<
  Environment,
  Error,
  CreateEnvironmentInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.environments.create(input),
    onSuccess: async (env) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.environments.all })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.environments.byClient(env.clientId)
      })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Ambiente criado')
    },
    onError: (error) => toastError(error, 'Não foi possível criar o ambiente')
  })
}

export function useUpdateEnvironment(): UseMutationResult<
  Environment,
  Error,
  { id: string; input: UpdateEnvironmentInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.environments.update(id, input),
    onSuccess: async (env) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.environments.all })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.environments.byClient(env.clientId)
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.environments.detail(env.id)
      })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Ambiente atualizado')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar o ambiente')
  })
}

export function useDeleteEnvironment(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.environments.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.environments.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Ambiente excluído')
    },
    onError: (error) => toastError(error, 'Não foi possível excluir o ambiente')
  })
}
