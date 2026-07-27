import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type { SetSecretInput } from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useVaultAvailable(): UseQueryResult<boolean, Error> {
  return useQuery({
    queryKey: queryKeys.vault.available,
    queryFn: () => window.north.vault.isAvailable()
  })
}

export function useHasSecret(
  credentialRef: string | null | undefined
): UseQueryResult<boolean, Error> {
  return useQuery({
    queryKey: queryKeys.vault.hasSecret(credentialRef ?? ''),
    queryFn: () => window.north.vault.hasSecret(credentialRef as string),
    enabled: Boolean(credentialRef)
  })
}

export function useSetSecret(): UseMutationResult<string, Error, SetSecretInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.vault.setSecret(input),
    onSuccess: async (ref) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vault.hasSecret(ref) })
    },
    onError: (error) => toastError(error, 'Não foi possível salvar a senha')
  })
}

export function useDeleteSecret(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentialRef) => window.north.vault.deleteSecret(credentialRef),
    onSuccess: async (_void, credentialRef) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vault.hasSecret(credentialRef) })
      toastSuccess('Senha removida')
    },
    onError: (error) => toastError(error, 'Não foi possível remover a senha')
  })
}

export function useRevealSecret(): UseMutationResult<string, Error, string> {
  return useMutation({
    mutationFn: (credentialRef) => window.north.vault.revealSecret({ credentialRef }),
    onError: (error) => toastError(error, 'Não foi possível revelar a senha')
  })
}
