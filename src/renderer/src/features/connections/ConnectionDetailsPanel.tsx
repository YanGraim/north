import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { EmptyState } from '@renderer/components/EmptyState'
import { EnvironmentBadge } from '@renderer/components/EnvironmentBadge'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Separator } from '@renderer/components/ui/separator'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ConnectionContextMenu } from '@renderer/features/connections/ConnectionContextMenu'
import { DetailField, DetailSection } from '@renderer/features/connections/DetailSection'
import { MarkdownNotes } from '@renderer/features/connections/MarkdownNotes'
import { TagBadges } from '@renderer/features/connections/TagBadges'
import { ConnectionSecretsSection } from '@renderer/features/workflows/ConnectionSecretsSection'
import { startWorkflowOnConnection } from '@renderer/features/workflows/start-workflow'
import { WorkflowHubDialog } from '@renderer/features/workflows/WorkflowHubDialog'
import { WorkflowInputsDialog } from '@renderer/features/workflows/WorkflowInputsDialog'
import { WorkflowSection } from '@renderer/features/workflows/WorkflowSection'
import {
  useConnection,
  useDeleteConnection,
  useDuplicateConnection,
  useToggleFavoriteConnection
} from '@renderer/hooks/use-connections'
import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { useSelectedConnectionId } from '@renderer/hooks/use-route-selection'
import { useConnectionTags } from '@renderer/hooks/use-tags'
import { useWorkflows } from '@renderer/hooks/use-workflows'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { authMethodLabel, formatRelativeDate } from '@renderer/lib/connection-ui'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError } from '@renderer/lib/toast'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { openConnectionSession, sessionKindForProtocol } from '@renderer/stores/sessions-store'
import type { Workflow } from '@shared/types'
import { useQueryClient } from '@tanstack/react-query'
import {
  CheckSquare,
  ChevronDown,
  ExternalLink,
  MoreHorizontal,
  MousePointerClick,
  Square,
  Star,
  X
} from 'lucide-react'
import { useState } from 'react'

export function ConnectionDetailsPanel(): React.JSX.Element {
  const { connectionId, setConnectionId } = useSelectedConnectionId()
  const { data: connection, isLoading, isError } = useConnection(connectionId ?? undefined)
  const { data: tags = [] } = useConnectionTags(connectionId ?? undefined)
  const { resolveGroup } = useOrgLookup()
  const toggleFavorite = useToggleFavoriteConnection()
  const duplicate = useDuplicateConnection()
  const deleteConnection = useDeleteConnection()
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)
  const [pendingWorkflow, setPendingWorkflow] = useState<Workflow | null>(null)
  const { data: groupWorkflows = [] } = useWorkflows(connection?.groupId)

  async function handleConnect(): Promise<void> {
    if (!connection) return
    setConnecting(true)
    try {
      await openConnectionSession(connection.id, {
        title: connection.name,
        protocol: connection.protocol,
        sessionKind: sessionKindForProtocol(connection.protocol),
        username: connection.username,
        host: connection.host
      })
    } catch (error) {
      toastError(error, 'Não foi possível conectar. Verifique a senha salva e tente novamente.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleRunWorkflow(workflow: Workflow): Promise<void> {
    if (!connection) return
    if (workflow.definition.inputs.length > 0) {
      setPendingWorkflow(workflow)
      return
    }
    await startWorkflowOnConnection({ workflow, connectionId: connection.id })
  }

  if (!connectionId) {
    return (
      <EmptyState
        icon={MousePointerClick}
        title="Selecione uma conexão"
        description="Escolha um item na lista para ver acesso, organização e metadados."
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 overflow-hidden p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Separator />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (isError || !connection) {
    return (
      <EmptyState
        icon={MousePointerClick}
        title="Conexão não encontrada"
        description="O item selecionado pode ter sido removido."
      />
    )
  }

  const org = resolveGroup(connection.groupId)

  return (
    <>
      <ConnectionContextMenu connection={connection}>
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {connection.name}
              </h2>
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={
                    connection.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
                  }
                  disabled={toggleFavorite.isPending}
                  onClick={() => toggleFavorite.mutate(connection.id)}
                >
                  <Star
                    className={
                      connection.isFavorite
                        ? 'size-3.5 fill-accent text-accent'
                        : 'size-3.5 text-muted'
                    }
                  />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Mais ações"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => duplicate.mutate(connection.id)}>
                      Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => void copyToClipboard(connection.host, 'Host')}
                    >
                      Copiar IP
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!connection.username}
                      onSelect={() =>
                        connection.username
                          ? void copyToClipboard(connection.username, 'Usuário')
                          : undefined
                      }
                    >
                      Copiar usuário
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Fechar detalhes"
                  title="Fechar"
                  onClick={() => setConnectionId(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="default" className="uppercase">
                {connection.protocol}
              </Badge>
              {connection.os ? <Badge variant="outline">{connection.os}</Badge> : null}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex min-w-0 flex-1">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8 min-w-0 flex-1 rounded-r-none"
                  disabled={connecting || !sessionKindForProtocol(connection.protocol)}
                  onClick={() => void handleConnect()}
                  data-testid="connect-button"
                >
                  {connecting ? 'Conectando…' : 'Conectar'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-8 rounded-l-none border-l border-l-background/20 px-2"
                      disabled={connection.protocol !== 'ssh'}
                      aria-label="Workflows da conexão"
                      data-testid="connect-split-chevron"
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" data-testid="connect-split-menu">
                    {groupWorkflows.map((workflow) => (
                      <DropdownMenuItem
                        key={workflow.id}
                        onSelect={() => void handleRunWorkflow(workflow)}
                      >
                        {workflow.name}
                      </DropdownMenuItem>
                    ))}
                    {groupWorkflows.length === 0 ? (
                      <DropdownMenuItem disabled>Nenhum workflow</DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      data-testid="connect-split-manage"
                      onSelect={() => setHubOpen(true)}
                    >
                      Gerenciar workflows…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 min-w-0 flex-1"
                onClick={() => openDialog({ type: 'connection', mode: 'edit', id: connection.id })}
              >
                Editar
              </Button>
            </div>
          </header>

          <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="min-w-0 space-y-5 overflow-x-hidden p-4">
              <DetailSection title="Acesso">
                <dl className="min-w-0 space-y-2.5">
                  <DetailField label="Host" value={`${connection.host}:${connection.port}`} mono />
                  <DetailField label="Usuário" value={connection.username ?? '—'} mono />
                  <DetailField
                    label="Autenticação"
                    value={authMethodLabel(connection.authMethod)}
                  />
                  <DetailField
                    label="Senha"
                    value={connection.credentialRef ? 'Definida (vault)' : '—'}
                  />
                  {connection.defaultCommand ? (
                    <DetailField label="Comando padrão" value={connection.defaultCommand} mono />
                  ) : null}
                </dl>
              </DetailSection>

              <Separator />

              <DetailSection title="Organização">
                <dl className="min-w-0 space-y-3">
                  <DetailField label="Cliente" value={org.client?.name ?? '—'} />
                  <DetailField
                    label="Ambiente"
                    value={
                      org.environment ? (
                        <EnvironmentBadge
                          name={org.environment.name}
                          color={org.environment.color}
                          showFullName
                        />
                      ) : (
                        '—'
                      )
                    }
                  />
                  <DetailField label="Grupo" value={org.group?.name ?? '—'} />
                  <DetailField label="Responsável" value={connection.owner ?? '—'} />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Tags</dt>
                    <dd className="mt-1.5 min-w-0">
                      {tags.length > 0 ? (
                        <TagBadges tags={tags} />
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </DetailSection>

              <Separator />

              <DetailSection title="Operação">
                <dl className="min-w-0 space-y-3">
                  <DetailField
                    label="VPN"
                    value={connection.vpnRequired ? 'Obrigatória' : 'Não necessária'}
                  />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Links úteis</dt>
                    <dd className="mt-1.5 min-w-0 space-y-1">
                      {connection.links.length === 0 ? (
                        <span className="text-sm text-muted">—</span>
                      ) : (
                        connection.links.map((link) => (
                          <a
                            key={`${link.label}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 items-center gap-1.5 text-sm text-accent hover:underline"
                          >
                            <ExternalLink className="size-3.5 shrink-0" />
                            <span className="truncate">{link.label}</span>
                          </a>
                        ))
                      )}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Checklist</dt>
                    <dd className="mt-1.5 min-w-0 space-y-1.5">
                      {connection.checklist.length === 0 ? (
                        <span className="text-sm text-muted">—</span>
                      ) : (
                        connection.checklist.map((item) => (
                          <div
                            key={item.id}
                            className="flex min-w-0 items-start gap-2 text-sm text-foreground"
                          >
                            {item.done ? (
                              <CheckSquare className="mt-0.5 size-3.5 shrink-0 text-accent" />
                            ) : (
                              <Square className="mt-0.5 size-3.5 shrink-0 text-muted" />
                            )}
                            <span
                              className={
                                item.done
                                  ? 'min-w-0 break-words text-muted line-through'
                                  : 'min-w-0 break-words'
                              }
                            >
                              {item.text}
                            </span>
                          </div>
                        ))
                      )}
                    </dd>
                  </div>
                </dl>
              </DetailSection>

              <Separator />

              <DetailSection title="Metadados">
                <dl className="min-w-0 space-y-3">
                  <DetailField label="Criado" value={formatRelativeDate(connection.createdAt)} />
                  <DetailField
                    label="Último acesso"
                    value={formatRelativeDate(connection.lastConnectedAt)}
                  />
                  <DetailField label="Acessos" value={String(connection.accessCount)} />
                  {connection.description ? (
                    <DetailField label="Descrição" value={connection.description} />
                  ) : null}
                </dl>
              </DetailSection>

              <Separator />

              <WorkflowSection
                groupId={connection.groupId}
                connectionId={connection.id}
                connectionProtocol={connection.protocol}
              />

              <Separator />

              <ConnectionSecretsSection connectionId={connection.id} />

              <Separator />

              {connection.notes !== undefined ? (
                <>
                  <DetailSection title="Notas">
                    <MarkdownNotes
                      notes={connection.notes}
                      onSave={async (notes) => {
                        await window.north.connections.update(connection.id, { notes })
                        void queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
                      }}
                    />
                  </DetailSection>
                </>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </ConnectionContextMenu>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir conexão?"
        description={`A conexão “${connection.name}” será removida permanentemente.`}
        confirming={deleteConnection.isPending}
        onConfirm={async () => {
          await deleteConnection.mutateAsync(connection.id)
          setConnectionId(null)
          setConfirmOpen(false)
        }}
      />

      <WorkflowHubDialog groupId={connection.groupId} open={hubOpen} onOpenChange={setHubOpen} />

      {pendingWorkflow ? (
        <WorkflowInputsDialog
          workflow={pendingWorkflow}
          open={Boolean(pendingWorkflow)}
          onOpenChange={(open) => {
            if (!open) setPendingWorkflow(null)
          }}
          onConfirm={async (inputValues) => {
            const workflow = pendingWorkflow
            setPendingWorkflow(null)
            await startWorkflowOnConnection({
              workflow,
              connectionId: connection.id,
              inputValues
            })
          }}
        />
      ) : null}
    </>
  )
}
