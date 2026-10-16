import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { mergeVpnState } from '@renderer/lib/vpn-ui'
import type {
  CreateVpnProfileInput,
  ImportOvpnInput,
  OvpnImportResult,
  SetVpnSecretInput,
  UpdateVpnProfileInput,
  VpnHistoryEntry,
  VpnPlatformSupport,
  VpnProfile,
  VpnSecretStatus,
  VpnState
} from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export function useVpnProfiles(): UseQueryResult<VpnProfile[], Error> {
  return useQuery({ queryKey: queryKeys.vpn.profiles, queryFn: () => window.north.vpn.list() })
}

/** Hydrate once, then follow `vpn:state-changed` (dropping out-of-order events). */
export function useVpnStates(): UseQueryResult<VpnState[], Error> {
  const queryClient = useQueryClient()

  useEffect(() => {
    return window.north.vpn.onStateChanged((state) => {
      queryClient.setQueryData<VpnState[]>(queryKeys.vpn.status, (prev) =>
        mergeVpnState(prev ?? [], state)
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.vpn.logs(state.profileId) })
      if (state.status === 'connected' || state.status === 'error') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.vpn.history(state.profileId) })
      }
    })
  }, [queryClient])

  return useQuery({ queryKey: queryKeys.vpn.status, queryFn: () => window.north.vpn.status() })
}

export function useVpnState(profileId: string | null | undefined): VpnState | undefined {
  const { data = [] } = useVpnStates()
  return profileId ? data.find((s) => s.profileId === profileId) : undefined
}

export function useVpnSecretStatus(
  id: string | null | undefined
): UseQueryResult<VpnSecretStatus, Error> {
  return useQuery({
    queryKey: queryKeys.vpn.secrets(id ?? ''),
    queryFn: () => window.north.vpn.secretStatus(id as string),
    enabled: Boolean(id)
  })
}

export function useVpnLogs(id: string | null | undefined): UseQueryResult<string[], Error> {
  return useQuery({
    queryKey: queryKeys.vpn.logs(id ?? ''),
    queryFn: () => window.north.vpn.logs(id as string),
    enabled: Boolean(id)
  })
}

export function useVpnHistory(
  id: string | null | undefined
): UseQueryResult<VpnHistoryEntry[], Error> {
  return useQuery({
    queryKey: queryKeys.vpn.history(id ?? ''),
    queryFn: () => window.north.vpn.history(id as string, 50),
    enabled: Boolean(id)
  })
}

export function useVpnPlatformSupport(): UseQueryResult<VpnPlatformSupport, Error> {
  return useQuery({
    queryKey: queryKeys.vpn.platformSupport,
    queryFn: () => window.north.vpn.platformSupport(),
    staleTime: Number.POSITIVE_INFINITY
  })
}

function useInvalidateVpn() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['vpn'] })
  }
}

export function useImportOvpn(): UseMutationResult<OvpnImportResult, Error, ImportOvpnInput> {
  const invalidate = useInvalidateVpn()
  return useMutation({
    mutationFn: (input) => window.north.vpn.importOvpn(input),
    onSuccess: invalidate
  })
}

export function useCreateVpn(): UseMutationResult<VpnProfile, Error, CreateVpnProfileInput> {
  const invalidate = useInvalidateVpn()
  return useMutation({
    mutationFn: (input) => window.north.vpn.create(input),
    onSuccess: invalidate
  })
}

export function useUpdateVpn(): UseMutationResult<
  VpnProfile,
  Error,
  { id: string; input: UpdateVpnProfileInput }
> {
  const invalidate = useInvalidateVpn()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.vpn.update(id, input),
    onSuccess: async () => {
      await invalidate()
      toastSuccess(t('vpn.toast.saved'))
    },
    onError: (error) => toastError(error, t('vpn.toast.saveFailed'))
  })
}

export function useDeleteVpn(): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidateVpn()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: async (id) => {
      await window.north.vpn.delete(id)
    },
    onSuccess: async () => {
      await invalidate()
      toastSuccess(t('vpn.toast.deleted'))
    },
    onError: (error) => toastError(error, t('vpn.toast.deleteFailed'))
  })
}

export function useSetVpnSecrets(): UseMutationResult<void, Error, SetVpnSecretInput[]> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inputs) => {
      for (const input of inputs) await window.north.vpn.setSecret(input)
    },
    onSuccess: async (_data, inputs) => {
      const ids = new Set(inputs.map((i) => i.profileId))
      for (const id of ids) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.vpn.secrets(id) })
      }
    }
  })
}

export function useDisconnectVpn(): UseMutationResult<VpnState, Error, string> {
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (id) => window.north.vpn.disconnect(id),
    onError: (error) => toastError(error, t('vpn.toast.disconnectFailed'))
  })
}
