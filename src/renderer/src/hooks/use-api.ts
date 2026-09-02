import { createApiCollection } from '@renderer/lib/api-collections'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type {
  ApiCollection,
  ApiFolder,
  ApiRequest,
  ApiRequestHistoryEntry,
  ApiVariablePublic,
  CreateApiCollectionInput,
  CreateApiFolderInput,
  CreateApiRequestInput,
  MoveApiRequestInput,
  SetApiVariableInput,
  UpdateApiCollectionInput,
  UpdateApiFolderInput,
  UpdateApiRequestInput
} from '@shared/types'
import {
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

function upsertCachedCollection(queryClient: QueryClient, collection: ApiCollection): void {
  queryClient.setQueriesData(
    { queryKey: ['api', 'collections'] },
    (old: ApiCollection[] | undefined) => {
      if (!old) return [collection]
      if (old.some((item) => item.id === collection.id)) return old
      return [...old, collection]
    }
  )
}

export function useApiCollections(filter?: {
  clientId?: string | null
}): UseQueryResult<ApiCollection[], Error> {
  const all = filter === undefined
  const scope = all ? 'all' : (filter.clientId ?? 'global')
  return useQuery({
    queryKey: queryKeys.api.collections(scope),
    queryFn: () => {
      if (typeof window.north.api.collectionList !== 'function') {
        throw new Error('Reinicie o North para listar collections.')
      }
      return all
        ? window.north.api.collectionList()
        : window.north.api.collectionList({ clientId: filter.clientId ?? null })
    }
  })
}

export function useApiFolders(
  collectionId: string | undefined
): UseQueryResult<ApiFolder[], Error> {
  return useQuery({
    queryKey: queryKeys.api.folders(collectionId ?? ''),
    queryFn: () => window.north.api.folderList(collectionId as string),
    enabled: Boolean(collectionId)
  })
}

export function useApiRequests(
  collectionId: string | undefined
): UseQueryResult<ApiRequest[], Error> {
  return useQuery({
    queryKey: queryKeys.api.requests(collectionId ?? ''),
    queryFn: () => window.north.api.requestList(collectionId as string),
    enabled: Boolean(collectionId)
  })
}

export function useApiVariables(
  accessId: string | undefined
): UseQueryResult<ApiVariablePublic[], Error> {
  return useQuery({
    queryKey: queryKeys.api.variables(accessId ?? ''),
    queryFn: () => window.north.api.variableList(accessId as string),
    enabled: Boolean(accessId)
  })
}

export function useApiHistory(
  accessId: string | undefined
): UseQueryResult<ApiRequestHistoryEntry[], Error> {
  return useQuery({
    queryKey: queryKeys.api.history(accessId ?? ''),
    queryFn: () => window.north.api.historyList({ accessId: accessId as string, limit: 50 }),
    enabled: Boolean(accessId)
  })
}

export function useCreateApiCollection(): UseMutationResult<
  ApiCollection,
  Error,
  CreateApiCollectionInput
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => createApiCollection(input),
    onSuccess: async (collection) => {
      upsertCachedCollection(queryClient, collection)
      await queryClient.invalidateQueries({ queryKey: ['api'] })
      toastSuccess(t('api.studio.collectionCreated'))
    },
    onError: (error) => toastError(error, t('api.studio.createCollectionError'))
  })
}

export function useUpdateApiCollection(): UseMutationResult<
  ApiCollection,
  Error,
  { id: string; input: UpdateApiCollectionInput }
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.api.collectionUpdate(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api', 'collections'] })
    },
    onError: (error) => toastError(error, t('api.studio.updateCollectionError'))
  })
}

export function useDeleteApiCollection(): UseMutationResult<void, Error, { id: string }> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => window.north.api.collectionDelete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api', 'collections'] })
      toastSuccess(t('api.studio.collectionDeleted'))
    },
    onError: (error) => toastError(error, t('api.studio.deleteCollectionError'))
  })
}

export function useCreateApiFolder(): UseMutationResult<ApiFolder, Error, CreateApiFolderInput> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.api.folderCreate(input),
    onSuccess: async (folder) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.api.folders(folder.collectionId) })
    },
    onError: (error) => toastError(error, t('api.studio.createFolderError'))
  })
}

export function useUpdateApiFolder(): UseMutationResult<
  ApiFolder,
  Error,
  { id: string; collectionId: string; input: UpdateApiFolderInput }
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.api.folderUpdate(id, input),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.api.folders(vars.collectionId) })
    },
    onError: (error) => toastError(error, t('api.studio.updateFolderError'))
  })
}

export function useDeleteApiFolder(): UseMutationResult<
  void,
  Error,
  { id: string; collectionId: string }
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => window.north.api.folderDelete(id),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.api.folders(vars.collectionId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.api.requests(vars.collectionId) })
    },
    onError: (error) => toastError(error, t('api.studio.deleteFolderError'))
  })
}

export function useCreateApiRequest(): UseMutationResult<ApiRequest, Error, CreateApiRequestInput> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.api.requestCreate(input),
    onSuccess: async (request) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.api.requests(request.collectionId)
      })
    },
    onError: (error) => toastError(error, t('api.studio.createRequestError'))
  })
}

export function useUpdateApiRequest(): UseMutationResult<
  ApiRequest,
  Error,
  { id: string; collectionId: string; input: UpdateApiRequestInput }
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.api.requestUpdate(id, input),
    onSuccess: async (request) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.api.requests(request.collectionId)
      })
    },
    onError: (error) => toastError(error, t('api.studio.saveRequestError'))
  })
}

export function useDeleteApiRequest(): UseMutationResult<
  void,
  Error,
  { id: string; collectionId: string }
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => window.north.api.requestDelete(id),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.api.requests(vars.collectionId) })
    },
    onError: (error) => toastError(error, t('api.studio.deleteRequestError'))
  })
}

export function useDuplicateApiRequest(): UseMutationResult<ApiRequest, Error, string> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => window.north.api.requestDuplicate(id),
    onSuccess: async (request) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.api.requests(request.collectionId)
      })
    },
    onError: (error) => toastError(error, t('api.studio.duplicateRequestError'))
  })
}

export function useMoveApiRequest(): UseMutationResult<ApiRequest, Error, MoveApiRequestInput> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.api.requestMove(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api', 'requests'] })
    },
    onError: (error) => toastError(error, t('api.studio.moveRequestError'))
  })
}

export function useSetApiVariable(): UseMutationResult<
  ApiVariablePublic,
  Error,
  SetApiVariableInput
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.api.variableSet(input),
    onSuccess: async (variable) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.api.variables(variable.accessId) })
    },
    onError: (error) => toastError(error, t('api.studio.saveVariableError'))
  })
}

export function useDeleteApiVariable(): UseMutationResult<
  void,
  Error,
  { id: string; accessId: string }
> {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => window.north.api.variableDelete(id),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.api.variables(vars.accessId) })
    },
    onError: (error) => toastError(error, t('api.studio.deleteVariableError'))
  })
}
