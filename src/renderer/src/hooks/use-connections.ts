import { invalidateSearchIndex } from '@renderer/lib/invalidate-inventory'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type {
  Connection,
  CreateConnectionInput,
  ListConnectionsFilter,
  UpdateConnectionInput
} from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useConnections(
  filter?: ListConnectionsFilter
): UseQueryResult<Connection[], Error> {
  return useQuery({
    queryKey: queryKeys.connections.list(filter),
    queryFn: () => window.north.connections.list(filter)
  })
}

export function useConnection(id: string | undefined): UseQueryResult<Connection | null, Error> {
  return useQuery({
    queryKey: queryKeys.connections.detail(id ?? ''),
    queryFn: () => window.north.connections.get(id as string),
    enabled: Boolean(id)
  })
}

export function useCreateConnection(): UseMutationResult<Connection, Error, CreateConnectionInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.connections.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Conexão criada')
    },
    onError: (error) => toastError(error, 'Não foi possível criar a conexão')
  })
}

export function useUpdateConnection(): UseMutationResult<
  Connection,
  Error,
  { id: string; input: UpdateConnectionInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.connections.update(id, input),
    onSuccess: async (connection) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.connections.detail(connection.id)
      })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Conexão atualizada')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar a conexão')
  })
}

export function useDeleteConnection(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.connections.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Conexão excluída')
    },
    onError: (error) => toastError(error, 'Não foi possível excluir a conexão')
  })
}

export function useToggleFavoriteConnection(): UseMutationResult<Connection, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.connections.toggleFavorite(id),
    onSuccess: async (connection) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.connections.detail(connection.id)
      })
      await invalidateSearchIndex(queryClient)

      toastSuccess(connection.isFavorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar favorito')
  })
}

export function useDuplicateConnection(): UseMutationResult<Connection, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.connections.duplicate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Conexão duplicada')
    },
    onError: (error) => toastError(error, 'Não foi possível duplicar a conexão')
  })
}
