import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type {
  ConnectionSecret,
  CopyWorkflowInput,
  CreateGroupVariableInput,
  CreateWorkflowInput,
  GroupVariable,
  SetConnectionSecretInput,
  StartWorkflowRunInput,
  UpdateGroupVariableInput,
  UpdateWorkflowInput,
  Workflow,
  WorkflowRun
} from '@shared/types'
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

export function useWorkflows(groupId: string | undefined): UseQueryResult<Workflow[], Error> {
  return useQuery({
    queryKey: queryKeys.workflows.byGroup(groupId ?? ''),
    queryFn: () => window.north.workflows.list(groupId as string),
    enabled: Boolean(groupId)
  })
}

export function useWorkflow(id: string | undefined): UseQueryResult<Workflow | null, Error> {
  return useQuery({
    queryKey: queryKeys.workflows.detail(id ?? ''),
    queryFn: () => window.north.workflows.get(id as string),
    enabled: Boolean(id)
  })
}

export function useGroupVariables(
  groupId: string | undefined
): UseQueryResult<GroupVariable[], Error> {
  return useQuery({
    queryKey: queryKeys.workflows.variables(groupId ?? ''),
    queryFn: () => window.north.workflows.listVariables(groupId as string),
    enabled: Boolean(groupId)
  })
}

export function useWorkflowRuns(groupId: string | undefined): UseQueryResult<WorkflowRun[], Error> {
  return useQuery({
    queryKey: queryKeys.workflows.runs(groupId ?? ''),
    queryFn: () => window.north.workflows.listRuns(groupId as string),
    enabled: Boolean(groupId)
  })
}

export function useConnectionSecrets(
  connectionId: string | undefined
): UseQueryResult<ConnectionSecret[], Error> {
  return useQuery({
    queryKey: queryKeys.workflows.connectionSecrets(connectionId ?? ''),
    queryFn: () => window.north.workflows.listConnectionSecrets(connectionId as string),
    enabled: Boolean(connectionId)
  })
}

export function useCreateWorkflow(): UseMutationResult<Workflow, Error, CreateWorkflowInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.workflows.create(input),
    onSuccess: async (workflow) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.byGroup(workflow.groupId)
      })
      toastSuccess('Workflow criado')
    },
    onError: (error) => toastError(error, 'Não foi possível criar o workflow')
  })
}

export function useCopyWorkflow(): UseMutationResult<Workflow[], Error, CopyWorkflowInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.workflows.copy(input),
    onSuccess: async (created) => {
      await Promise.all(
        created.map((workflow) =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.workflows.byGroup(workflow.groupId)
          })
        )
      )
      toastSuccess(
        created.length === 1 ? 'Workflow copiado' : `Workflow copiado para ${created.length} grupos`
      )
    },
    onError: (error) => toastError(error, 'Não foi possível copiar o workflow')
  })
}

export function useUpdateWorkflow(): UseMutationResult<
  Workflow,
  Error,
  { id: string; input: UpdateWorkflowInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.workflows.update(id, input),
    onSuccess: async (workflow) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.byGroup(workflow.groupId)
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(workflow.id) })
      toastSuccess('Workflow atualizado')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar o workflow')
  })
}

export function useDeleteWorkflow(): UseMutationResult<
  void,
  Error,
  { id: string; groupId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => window.north.workflows.delete(id),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workflows.byGroup(vars.groupId) })
      toastSuccess('Workflow excluído')
    },
    onError: (error) => toastError(error, 'Não foi possível excluir o workflow')
  })
}

export function useCreateGroupVariable(): UseMutationResult<
  GroupVariable,
  Error,
  CreateGroupVariableInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.workflows.createVariable(input),
    onSuccess: async (variable) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.variables(variable.groupId)
      })
      toastSuccess('Variável criada')
    },
    onError: (error) => toastError(error, 'Não foi possível criar a variável')
  })
}

export function useUpdateGroupVariable(): UseMutationResult<
  GroupVariable,
  Error,
  { id: string; groupId: string; input: UpdateGroupVariableInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }) => window.north.workflows.updateVariable(id, input),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.variables(vars.groupId)
      })
      toastSuccess('Variável atualizada')
    },
    onError: (error) => toastError(error, 'Não foi possível atualizar a variável')
  })
}

export function useDeleteGroupVariable(): UseMutationResult<
  void,
  Error,
  { id: string; groupId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => window.north.workflows.deleteVariable(id),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.variables(vars.groupId)
      })
      toastSuccess('Variável excluída')
    },
    onError: (error) => toastError(error, 'Não foi possível excluir a variável')
  })
}

export function useStartWorkflowRun(): UseMutationResult<
  WorkflowRun,
  Error,
  StartWorkflowRunInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.workflows.run(input),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workflows.runs(run.groupId) })
    },
    onError: (error) => toastError(error, 'Não foi possível iniciar o workflow')
  })
}

export function useSetConnectionSecret(): UseMutationResult<
  ConnectionSecret,
  Error,
  SetConnectionSecretInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => window.north.workflows.setConnectionSecret(input),
    onSuccess: async (secret) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.connectionSecrets(secret.connectionId)
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      toastSuccess('Segredo salvo')
    },
    onError: (error) => toastError(error, 'Não foi possível salvar o segredo')
  })
}

export function useDeleteConnectionSecret(): UseMutationResult<
  void,
  Error,
  { connectionId: string; kind: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, kind }) =>
      window.north.workflows.deleteConnectionSecret(connectionId, kind),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.connectionSecrets(vars.connectionId)
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
      toastSuccess('Segredo removido')
    },
    onError: (error) => toastError(error, 'Não foi possível remover o segredo')
  })
}
