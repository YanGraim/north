import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { InventoryIcon } from '@renderer/components/InventoryIcon'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@renderer/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { startWorkflowOnConnection } from '@renderer/features/workflows/start-workflow'
import { WorkflowHubDialog } from '@renderer/features/workflows/WorkflowHubDialog'
import { WorkflowInputsDialog } from '@renderer/features/workflows/WorkflowInputsDialog'
import {
  useConnection,
  useDeleteConnection,
  useDuplicateConnection,
  useToggleFavoriteConnection
} from '@renderer/hooks/use-connections'
import { useSelectedConnectionId } from '@renderer/hooks/use-route-selection'
import { useSearchIndex } from '@renderer/hooks/use-search-index'
import { useWorkflows } from '@renderer/hooks/use-workflows'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { resolveEntityIcon } from '@renderer/lib/entity-icons'
import { exportInventory, importInventory } from '@renderer/lib/inventory-actions'
import {
  groupSearchHits,
  highlightMatches,
  type SearchHit,
  searchIndex
} from '@renderer/lib/search'
import { shortcutDisplayLabel } from '@renderer/lib/shortcuts'
import { toastError } from '@renderer/lib/toast'
import { useCommandPaletteStore } from '@renderer/stores/command-palette-store'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import {
  openAccessSession,
  openConnectionSession,
  sessionKindForProtocol
} from '@renderer/stores/sessions-store'
import { useWhatsNewStore } from '@renderer/stores/whats-new-store'
import { isSqlStudioEngine } from '@shared/protocols'
import type { SearchIndexItem, SearchIndexKind, Workflow } from '@shared/types'
import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Building2,
  Clock3,
  Database,
  Download,
  FolderTree,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  Server,
  Settings,
  Sparkles,
  Star,
  Tag,
  Upload,
  Workflow as WorkflowIcon
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

const KIND_LABELS: Record<SearchIndexKind, string> = {
  connection: 'Conexões',
  access: 'Acessos',
  client: 'Clientes',
  environment: 'Ambientes',
  group: 'Grupos',
  tag: 'Tags'
}

const KIND_ORDER: SearchIndexKind[] = [
  'connection',
  'access',
  'client',
  'environment',
  'group',
  'tag'
]

export function CommandPalette(): React.JSX.Element {
  const { t } = useTranslation()
  const open = useCommandPaletteStore((s) => s.open)
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const openWhatsNew = useWhatsNewStore((s) => s.openWhatsNew)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: index = [] } = useSearchIndex()
  const [query, setQuery] = useState('')
  const [actionsFor, setActionsFor] = useState<SearchIndexItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SearchIndexItem | null>(null)
  const [pickWorkflow, setPickWorkflow] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)
  const [pendingWorkflow, setPendingWorkflow] = useState<Workflow | null>(null)
  const { connectionId } = useSelectedConnectionId()
  const { data: selectedConnection } = useConnection(connectionId ?? undefined)
  const { data: paletteWorkflows = [] } = useWorkflows(selectedConnection?.groupId)

  const toggleFavorite = useToggleFavoriteConnection()
  const duplicate = useDuplicateConnection()
  const deleteConnection = useDeleteConnection()

  const hits = useMemo(() => searchIndex(index, query), [index, query])
  const grouped = useMemo(() => groupSearchHits(hits), [hits])

  const recentConnections = useMemo(() => {
    return index
      .filter((item) => item.kind === 'connection' && item.lastConnectedAt)
      .sort((a, b) => {
        const aTime = a.lastConnectedAt ? Date.parse(a.lastConnectedAt) : 0
        const bTime = b.lastConnectedAt ? Date.parse(b.lastConnectedAt) : 0
        return bTime - aTime
      })
      .slice(0, 5)
  }, [index])

  function close(): void {
    setOpen(false)
    setQuery('')
    setActionsFor(null)
  }

  function goToItem(item: SearchIndexItem): void {
    close()
    switch (item.kind) {
      case 'connection':
        if (item.clientId) {
          const params = new URLSearchParams()
          if (item.environmentId) params.set('env', item.environmentId)
          if (item.groupId) params.set('group', item.groupId)
          params.set('connection', item.id)
          navigate(`/clients/${item.clientId}?${params.toString()}`)
        } else {
          navigate(`/connections?connection=${item.id}`)
        }
        break
      case 'access':
        if (item.clientId) {
          const params = new URLSearchParams()
          if (item.environmentId) params.set('env', item.environmentId)
          if (item.groupId) params.set('group', item.groupId)
          params.set('access', item.id)
          navigate(`/clients/${item.clientId}?${params.toString()}`)
        } else {
          navigate(`/connections?access=${item.id}`)
        }
        break
      case 'client':
        navigate(`/clients/${item.id}`)
        break
      case 'environment':
        if (item.clientId) {
          navigate(`/clients/${item.clientId}?env=${item.id}`)
        }
        break
      case 'group':
        if (item.clientId) {
          const params = new URLSearchParams()
          if (item.environmentId) params.set('env', item.environmentId)
          params.set('group', item.id)
          navigate(`/clients/${item.clientId}?${params.toString()}`)
        }
        break
      case 'tag':
        navigate(`/tags/${item.id}`)
        break
    }
  }

  const showActions = actionsFor?.kind === 'connection'

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
          else setOpen(true)
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Busca global e ações rápidas do North
          </DialogDescription>
          <Command
            shouldFilter={false}
            className="rounded-lg border-0"
            onKeyDown={(event) => {
              if (event.key === 'Tab' && !query.trim() && !actionsFor) return
              if (event.key === 'Tab' && !actionsFor) {
                const firstConnection = grouped.connection[0]?.item
                if (firstConnection) {
                  event.preventDefault()
                  setActionsFor(firstConnection)
                }
              }
              if (event.key === 'Escape' && actionsFor) {
                event.preventDefault()
                setActionsFor(null)
              }
            }}
          >
            <CommandInput
              placeholder="Buscar conexões, clientes, tags…"
              value={query}
              onValueChange={(value) => {
                setQuery(value)
                setActionsFor(null)
              }}
            />
            <CommandList>
              {showActions && actionsFor?.kind === 'access' ? (
                <AccessActions
                  item={actionsFor}
                  onBack={() => setActionsFor(null)}
                  onConnect={() => {
                    const id = actionsFor.id
                    const title = actionsFor.title
                    close()
                    void openAccessSession(id, {
                      title,
                      host: actionsFor.host,
                      username: actionsFor.username
                    }).catch((error: unknown) => {
                      toastError(error, 'Não foi possível conectar.')
                    })
                  }}
                  onEdit={() => {
                    close()
                    openDialog({ type: 'access', mode: 'edit', id: actionsFor.id })
                  }}
                />
              ) : showActions && actionsFor ? (
                <ConnectionActions
                  item={actionsFor}
                  onBack={() => setActionsFor(null)}
                  onConnect={() => {
                    const id = actionsFor.id
                    const title = actionsFor.title
                    const protocol = actionsFor.protocol ?? undefined
                    close()
                    void openConnectionSession(id, {
                      title,
                      protocol,
                      sessionKind: protocol ? sessionKindForProtocol(protocol) : undefined,
                      host: actionsFor.host,
                      username: actionsFor.username
                    }).catch((error: unknown) => {
                      toastError(
                        error,
                        'Não foi possível conectar. Verifique a senha salva e tente novamente.'
                      )
                    })
                  }}
                  onEdit={() => {
                    close()
                    openDialog({ type: 'connection', mode: 'edit', id: actionsFor.id })
                  }}
                  onDuplicate={() => {
                    duplicate.mutate(actionsFor.id)
                    close()
                  }}
                  onFavorite={() => {
                    toggleFavorite.mutate(actionsFor.id)
                    close()
                  }}
                  onCopyHost={() => {
                    void copyToClipboard(actionsFor.host ?? '', 'Host')
                    close()
                  }}
                  onDelete={() => {
                    setConfirmDelete(actionsFor)
                    setOpen(false)
                  }}
                />
              ) : query.trim() ? (
                <>
                  <CommandEmpty>Nenhum resultado para “{query.trim()}”</CommandEmpty>
                  {KIND_ORDER.map((kind) => {
                    const groupHits = grouped[kind]
                    if (groupHits.length === 0) return null
                    return (
                      <CommandGroup key={kind} heading={KIND_LABELS[kind]}>
                        {groupHits.slice(0, 8).map((hit) => (
                          <SearchResultItem
                            key={`${hit.item.kind}-${hit.item.id}`}
                            hit={hit}
                            onSelect={() => goToItem(hit.item)}
                            onActions={
                              hit.item.kind === 'connection' ||
                              (hit.item.kind === 'access' && hit.item.accessType === 'database')
                                ? () => setActionsFor(hit.item)
                                : undefined
                            }
                          />
                        ))}
                      </CommandGroup>
                    )
                  })}
                </>
              ) : (
                <>
                  {recentConnections.length > 0 ? (
                    <CommandGroup heading="Recentes">
                      {recentConnections.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`recent-${item.id}`}
                          onSelect={() => goToItem(item)}
                        >
                          <RecentIcon item={item} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{item.title}</p>
                            {item.subtitle ? (
                              <p className="truncate text-xs text-muted">{item.subtitle}</p>
                            ) : null}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  <CommandGroup heading="Ações rápidas">
                    <CommandItem
                      value="action-run-workflow"
                      onSelect={() => {
                        if (!selectedConnection || selectedConnection.protocol !== 'ssh') {
                          toastError(
                            new Error(
                              'Selecione uma conexão SSH no inventário para executar um workflow.'
                            )
                          )
                          return
                        }
                        setPickWorkflow(true)
                      }}
                    >
                      <WorkflowIcon className="size-4 text-muted" />
                      Executar workflow…
                    </CommandItem>
                    {pickWorkflow
                      ? paletteWorkflows.map((workflow) => (
                          <CommandItem
                            key={workflow.id}
                            value={`workflow-run-${workflow.name}`}
                            onSelect={() => {
                              close()
                              setPickWorkflow(false)
                              if (workflow.definition.inputs.length > 0) {
                                setPendingWorkflow(workflow)
                                return
                              }
                              if (selectedConnection) {
                                void startWorkflowOnConnection({
                                  workflow,
                                  connectionId: selectedConnection.id
                                })
                              }
                            }}
                          >
                            <WorkflowIcon className="size-4 text-accent" />
                            {workflow.name}
                          </CommandItem>
                        ))
                      : null}
                    {pickWorkflow && selectedConnection ? (
                      <CommandItem
                        value="action-manage-workflows"
                        onSelect={() => {
                          close()
                          setPickWorkflow(false)
                          setHubOpen(true)
                        }}
                      >
                        <WorkflowIcon className="size-4 text-muted" />
                        Gerenciar workflows…
                      </CommandItem>
                    ) : null}
                    <CommandItem
                      value="action-new-connection"
                      onSelect={() => {
                        close()
                        openDialog({ type: 'connection', mode: 'create' })
                      }}
                    >
                      <Server className="size-4 text-muted" />
                      Nova conexão · servidor
                      <CommandShortcut>{shortcutDisplayLabel('newConnection')}</CommandShortcut>
                    </CommandItem>
                    <CommandItem
                      value="action-new-database"
                      onSelect={() => {
                        close()
                        openDialog({ type: 'access', mode: 'create', accessType: 'database' })
                      }}
                    >
                      <Database className="size-4 text-muted" />
                      Nova conexão · banco
                    </CommandItem>
                    <CommandItem
                      value="action-new-client"
                      onSelect={() => {
                        close()
                        openDialog({ type: 'client', mode: 'create' })
                      }}
                    >
                      <Building2 className="size-4 text-muted" />
                      Novo cliente
                    </CommandItem>
                    <CommandItem
                      value="action-dashboard"
                      onSelect={() => {
                        close()
                        navigate('/dashboard')
                      }}
                    >
                      <LayoutDashboard className="size-4 text-muted" />
                      Ir para Dashboard
                    </CommandItem>
                    <CommandItem
                      value="action-favorites"
                      onSelect={() => {
                        close()
                        navigate('/favorites')
                      }}
                    >
                      <Star className="size-4 text-muted" />
                      Ir para Favoritos
                    </CommandItem>
                    <CommandItem
                      value="action-history"
                      onSelect={() => {
                        close()
                        navigate('/history')
                      }}
                    >
                      <Clock3 className="size-4 text-muted" />
                      Ir para Histórico
                    </CommandItem>
                    <CommandItem
                      value="action-settings"
                      onSelect={() => {
                        close()
                        navigate('/settings')
                      }}
                    >
                      <Settings className="size-4 text-muted" />
                      Ir para Configurações
                    </CommandItem>
                    <CommandItem
                      value="action-manual Abrir manual help tutorial guia"
                      onSelect={() => {
                        close()
                        navigate('/settings/manual')
                      }}
                    >
                      <BookOpen className="size-4 text-muted" />
                      {t('help.openManual')}
                    </CommandItem>
                    <CommandItem
                      value="action-whats-new novidades whats new patch atualizacao"
                      onSelect={() => {
                        close()
                        openWhatsNew({ force: true })
                      }}
                    >
                      <Sparkles className="size-4 text-muted" />
                      {t('whatsNew.openFromPalette')}
                    </CommandItem>
                    <CommandItem
                      value="action-tutorial primeiros passos getting started"
                      onSelect={() => {
                        close()
                        navigate('/settings/manual?chapter=getting-started')
                      }}
                    >
                      <GraduationCap className="size-4 text-muted" />
                      {t('help.tutorialGettingStarted')}
                    </CommandItem>
                    <CommandItem
                      value="action-export"
                      onSelect={() => {
                        close()
                        void exportInventory().catch(() => {
                          /* toast já exibido */
                        })
                      }}
                    >
                      <Download className="size-4 text-muted" />
                      Exportar inventário
                    </CommandItem>
                    <CommandItem
                      value="action-import"
                      onSelect={() => {
                        close()
                        void importInventory(queryClient).catch(() => {
                          /* toast já exibido */
                        })
                      }}
                    >
                      <Upload className="size-4 text-muted" />
                      Importar inventário
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
            <div className="flex items-center gap-3 border-t border-border px-3 py-2 font-mono text-[11px] text-muted">
              <span>
                <kbd className="rounded border border-border bg-surface-elevated px-1">↵</kbd> abrir
              </span>
              <span>
                <kbd className="rounded border border-border bg-surface-elevated px-1">tab</kbd>{' '}
                ações
              </span>
              <span>
                <kbd className="rounded border border-border bg-surface-elevated px-1">esc</kbd>{' '}
                fechar
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>

      {confirmDelete ? (
        <ConfirmDeleteDialog
          open={Boolean(confirmDelete)}
          onOpenChange={(next) => {
            if (!next) setConfirmDelete(null)
          }}
          title="Excluir conexão?"
          description={`A conexão “${confirmDelete.title}” será removida permanentemente.`}
          confirming={deleteConnection.isPending}
          onConfirm={async () => {
            await deleteConnection.mutateAsync(confirmDelete.id)
            setConfirmDelete(null)
          }}
        />
      ) : null}

      {selectedConnection ? (
        <WorkflowHubDialog
          groupId={selectedConnection.groupId}
          open={hubOpen}
          onOpenChange={setHubOpen}
        />
      ) : null}

      {pendingWorkflow && selectedConnection ? (
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
              connectionId: selectedConnection.id,
              inputValues
            })
          }}
        />
      ) : null}
    </>
  )
}

function ConnectionActions({
  item,
  onBack,
  onConnect,
  onEdit,
  onDuplicate,
  onFavorite,
  onCopyHost,
  onDelete
}: {
  item: SearchIndexItem
  onBack: () => void
  onConnect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onFavorite: () => void
  onCopyHost: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <CommandGroup heading={`Ações · ${item.title}`}>
      <CommandItem value="action-back" onSelect={onBack}>
        Voltar
      </CommandItem>
      <CommandItem value="action-connect" onSelect={onConnect}>
        Conectar
      </CommandItem>
      <CommandItem value="action-edit" onSelect={onEdit}>
        Editar
      </CommandItem>
      <CommandItem value="action-duplicate" onSelect={onDuplicate}>
        Duplicar
      </CommandItem>
      <CommandItem value="action-favorite" onSelect={onFavorite}>
        {item.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
      </CommandItem>
      <CommandItem value="action-copy-host" onSelect={onCopyHost} disabled={!item.host}>
        Copiar IP
      </CommandItem>
      <CommandItem value="action-delete" onSelect={onDelete} className="text-red-400">
        Excluir
      </CommandItem>
    </CommandGroup>
  )
}

function AccessActions({
  item,
  onBack,
  onConnect,
  onEdit
}: {
  item: SearchIndexItem
  onBack: () => void
  onConnect: () => void
  onEdit: () => void
}): React.JSX.Element {
  return (
    <CommandGroup heading={`Ações · ${item.title}`}>
      <CommandItem value="action-back" onSelect={onBack}>
        Voltar
      </CommandItem>
      {isSqlStudioEngine(item.engine) ? (
        <CommandItem value="action-connect" onSelect={onConnect}>
          Conectar
        </CommandItem>
      ) : null}
      <CommandItem value="action-edit" onSelect={onEdit}>
        Editar
      </CommandItem>
    </CommandGroup>
  )
}

function SearchResultItem({
  hit,
  onSelect,
  onActions
}: {
  hit: SearchHit
  onSelect: () => void
  onActions?: () => void
}): React.JSX.Element {
  const nameMatch = hit.matches?.find((m) => m.key === 'name')
  const hostMatch = hit.matches?.find((m) => m.key === 'host')
  const parts = highlightMatches(hit.item.title, nameMatch?.indices)

  return (
    <CommandItem
      value={`${hit.item.kind}-${hit.item.id}`}
      onSelect={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Tab' && onActions) {
          event.preventDefault()
          onActions()
        }
      }}
    >
      <ItemIcon item={hit.item} />
      <div className="min-w-0 flex-1">
        <p className="truncate">
          {parts.map((part) => (
            <span
              key={`${part.matched ? 'm' : 'u'}:${part.text}`}
              className={part.matched ? 'text-accent' : undefined}
            >
              {part.text}
            </span>
          ))}
        </p>
        <p className="truncate font-mono text-xs text-muted">
          {hostMatch
            ? highlightMatches(hit.item.host ?? '', hostMatch.indices).map((part) => (
                <span
                  key={`${part.matched ? 'm' : 'u'}:${part.text}`}
                  className={part.matched ? 'text-accent' : undefined}
                >
                  {part.text}
                </span>
              ))
            : (hit.item.subtitle ?? hit.item.host)}
        </p>
      </div>
      {onActions ? <CommandShortcut className="opacity-60">tab</CommandShortcut> : null}
    </CommandItem>
  )
}

function ItemIcon({ item }: { item: SearchIndexItem }): React.JSX.Element {
  const className = 'size-4 shrink-0 text-muted'

  if (item.kind === 'connection' && item.protocol) {
    return <InventoryIcon className={className} icon={item.icon} protocol={item.protocol} />
  }

  if (item.kind === 'access' && item.accessType) {
    return (
      <InventoryIcon
        className={className}
        icon={item.icon}
        accessType={item.accessType}
        engine={item.engine}
      />
    )
  }

  if (item.icon) {
    const Icon = resolveEntityIcon(item.icon)
    return <Icon className={className} />
  }

  return <KindIcon kind={item.kind} />
}

function KindIcon({ kind }: { kind: SearchIndexKind }): React.JSX.Element {
  const className = 'size-4 shrink-0 text-muted'
  switch (kind) {
    case 'connection':
      return <Server className={className} />
    case 'access':
      return <KeyRound className={className} />
    case 'client':
      return <Building2 className={className} />
    case 'environment':
      return <Layers className={className} />
    case 'group':
      return <FolderTree className={className} />
    case 'tag':
      return <Tag className={className} />
  }
}

function RecentIcon({ item }: { item: SearchIndexItem }): React.JSX.Element {
  return <ItemIcon item={item} />
}
