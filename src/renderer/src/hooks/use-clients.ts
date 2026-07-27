import { invalidateSearchIndex } from '@renderer/lib/invalidate-inventory'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type { Client, CreateClientInput, UpdateClientInput } from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useClients(): UseQueryResult<Client[], Error> {
  return useQuery({
    queryKey: queryKeys.clients.all,
    queryFn: () => window.north.clients.list()
  })
}

export function useClient(id: string | undefined): UseQueryResult<Client | null, Error> {
  return useQuery({
    queryKey: queryKeys.clients.detail(id ?? ''),
    queryFn: () => window.north.clients.get(id as string),
    enabled: Boolean(id)
  })
}

export function useCreateClient(): UseMutationResult<Client, Error, CreateClientInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.clients.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Cliente criado')
    },
    onError: (error) => toastError(error, 'Não foi possível criar o cliente')
  })
}

export function useUpdateClient(): UseMutationResult<
  Client,
  Error,
  { id: string; input: UpdateClientInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.clients.update(id, input),
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(client.id) })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Cliente atualizado')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar o cliente')
  })
}

export function useDeleteClient(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.clients.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.environments.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      await invalidateSearchIndex(queryClient)

      toastSuccess('Cliente excluído')
    },
    onError: (error) => toastError(error, 'Não foi possível excluir o cliente')
  })
}
