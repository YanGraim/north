import { invalidateSearchIndex } from '@renderer/lib/invalidate-inventory'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type { CreateGroupInput, Group, UpdateGroupInput } from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useGroups(environmentId?: string): UseQueryResult<Group[], Error> {
  return useQuery({
    queryKey: queryKeys.groups.byEnvironment(environmentId),
    queryFn: () => window.north.groups.list(environmentId)
  })
}

export function useGroup(id: string | undefined): UseQueryResult<Group | null, Error> {
  return useQuery({
    queryKey: queryKeys.groups.detail(id ?? ''),
    queryFn: () => window.north.groups.get(id as string),
    enabled: Boolean(id)
  })
}

export function useCreateGroup(): UseMutationResult<Group, Error, CreateGroupInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.groups.create(input),
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groups.byEnvironment(group.environmentId)
      })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Grupo criado')
    },
    onError: (error) => toastError(error, 'Não foi possível criar o grupo')
  })
}

export function useUpdateGroup(): UseMutationResult<
  Group,
  Error,
  { id: string; input: UpdateGroupInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.groups.update(id, input),
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groups.byEnvironment(group.environmentId)
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(group.id) })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Grupo atualizado')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar o grupo')
  })
}

export function useDeleteGroup(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.groups.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Grupo excluído')
    },
    onError: (error) => toastError(error, 'Não foi possível excluir o grupo')
  })
}
