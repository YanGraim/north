import { invalidateSearchIndex } from '@renderer/lib/invalidate-inventory'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type {
  CreateTagInput,
  SetAccessTagsInput,
  SetConnectionTagsInput,
  Tag,
  UpdateTagInput
} from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useTags(): UseQueryResult<Tag[], Error> {
  return useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => window.north.tags.list()
  })
}

export function useConnectionTags(connectionId: string | undefined): UseQueryResult<Tag[], Error> {
  return useQuery({
    queryKey: queryKeys.tags.forConnection(connectionId ?? ''),
    queryFn: () => window.north.tags.listForConnection(connectionId as string),
    enabled: Boolean(connectionId)
  })
}

export function useAccessTags(accessId: string | undefined): UseQueryResult<Tag[], Error> {
  return useQuery({
    queryKey: queryKeys.tags.forAccess(accessId ?? ''),
    queryFn: () => window.north.tags.listForAccess(accessId as string),
    enabled: Boolean(accessId)
  })
}

export function useCreateTag(): UseMutationResult<Tag, Error, CreateTagInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.tags.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Tag criada')
    },
    onError: (error) => toastError(error, 'Não foi possível criar a tag')
  })
}

export function useUpdateTag(): UseMutationResult<
  Tag,
  Error,
  { id: string; input: UpdateTagInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.tags.update(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Tag atualizada')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar a tag')
  })
}

export function useDeleteTag(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.tags.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.accesses.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Tag excluída')
    },
    onError: (error) => toastError(error, 'Não foi possível excluir a tag')
  })
}

export function useSetConnectionTags(): UseMutationResult<Tag[], Error, SetConnectionTagsInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.tags.setForConnection(input),
    onSuccess: async (_tags, input) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tags.forConnection(input.connectionId)
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await invalidateSearchIndex(queryClient)
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar as tags')
  })
}

export function useSetAccessTags(): UseMutationResult<Tag[], Error, SetAccessTagsInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.tags.setForAccess(input),
    onSuccess: async (_tags, input) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tags.forAccess(input.accessId)
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.accesses.all })
      await invalidateSearchIndex(queryClient)
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar as tags')
  })
}
