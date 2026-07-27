import { invalidateSearchIndex } from '@renderer/lib/invalidate-inventory'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type {
  Access,
  CreateAccessInput,
  ListAccessesFilter,
  UpdateAccessInput
} from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useAccesses(filter?: ListAccessesFilter): UseQueryResult<Access[], Error> {
  return useQuery({
    queryKey: queryKeys.accesses.list(filter),
    queryFn: () => window.north.accesses.list(filter)
  })
}

export function useAccess(id: string | undefined): UseQueryResult<Access | null, Error> {
  return useQuery({
    queryKey: queryKeys.accesses.detail(id ?? ''),
    queryFn: () => window.north.accesses.get(id as string),
    enabled: Boolean(id)
  })
}

export function useCreateAccess(): UseMutationResult<Access, Error, CreateAccessInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.accesses.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accesses.all })
      await invalidateSearchIndex(queryClient)
      toastSuccess('Acesso criado')
    },
    onError: (error) => toastError(error, 'Não foi possível criar o acesso')
  })
}

export function useUpdateAccess(): UseMutationResult<
  Access,
  Error,
  { id: string; input: UpdateAccessInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.accesses.update(id, input),
    onSuccess: async (access) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accesses.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.accesses.detail(access.id) })
      await invalidateSearchIndex(queryClient)
      toastSuccess('Acesso atualizado')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar o acesso')
  })
}

export function useDeleteAccess(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.accesses.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accesses.all })
      await invalidateSearchIndex(queryClient)
      toastSuccess('Acesso excluído')
    },
    onError: (error) => toastError(error, 'Não foi possível excluir o acesso')
  })
}

export function useToggleFavoriteAccess(): UseMutationResult<Access, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.accesses.toggleFavorite(id),
    onSuccess: async (access) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accesses.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.accesses.detail(access.id) })
      await invalidateSearchIndex(queryClient)
      toastSuccess(access.isFavorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar favorito')
  })
}
