import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  ConnectionList,
  type InventoryListItem
} from '@renderer/features/connections/ConnectionList'
import { useAccesses } from '@renderer/hooks/use-accesses'
import { useClient, useClients } from '@renderer/hooks/use-clients'
import { useConnections } from '@renderer/hooks/use-connections'
import { useEnvironment } from '@renderer/hooks/use-environments'
import { useGroup } from '@renderer/hooks/use-groups'
import { useClientFilters } from '@renderer/hooks/use-route-selection'
import { useTags } from '@renderer/hooks/use-tags'
import { shortcutDisplayLabel } from '@renderer/lib/shortcuts'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { useUiStore } from '@renderer/stores/ui-store'
import type { AccessType, ListAccessesFilter, ListConnectionsFilter } from '@shared/types'
import { ArrowUpDown, ListFilter, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

type ListMode = 'all' | 'favorites' | 'recents' | 'client' | 'tag'
type KindFilter = 'all' | 'connection' | AccessType

type ConnectionListPageProps = {
  mode: ListMode
}

export function ConnectionListPage({ mode }: ConnectionListPageProps): React.JSX.Element {
  const { t } = useTranslation()
  const { clientId, tagId } = useParams()
  const navigate = useNavigate()
  const { environmentId, groupId } = useClientFilters()
  const listSort = useUiStore((s) => s.listSort)
  const setListSort = useUiStore((s) => s.setListSort)
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')

  const connectionFilter = useMemo((): ListConnectionsFilter | undefined => {
    if (mode === 'favorites') return { isFavorite: true }
    if (mode === 'tag' && tagId) return { tagId }
    if (mode === 'client' && clientId) {
      if (groupId) return { groupId }
      if (environmentId) return { environmentId }
      return { clientId }
    }
    return undefined
  }, [mode, tagId, clientId, groupId, environmentId])

  const accessFilter = useMemo((): ListAccessesFilter | undefined => {
    if (mode === 'favorites') return { isFavorite: true }
    if (mode === 'tag' && tagId) return { tagId }
    if (mode === 'client' && clientId) {
      if (groupId) return { groupId }
      if (environmentId) return { environmentId }
      return { clientId }
    }
    return undefined
  }, [mode, tagId, clientId, groupId, environmentId])

  const {
    data: connections = [],
    isLoading: connectionsLoading,
    isError: connectionsError
  } = useConnections(connectionFilter)
  const {
    data: accesses = [],
    isLoading: accessesLoading,
    isError: accessesError
  } = useAccesses(mode === 'recents' ? undefined : accessFilter)
  const { data: allConnections = [] } = useConnections()
  const { data: allAccesses = [] } = useAccesses()
  const { data: clients = [] } = useClients()
  const { data: client } = useClient(mode === 'client' ? clientId : undefined)
  const { data: environment } = useEnvironment(environmentId ?? undefined)
  const { data: group } = useGroup(groupId ?? undefined)
  const { data: tags = [] } = useTags()
  const tag = mode === 'tag' ? tags.find((t) => t.id === tagId) : undefined

  const isLoading = connectionsLoading || (mode !== 'recents' && accessesLoading)
  const isError = connectionsError || (mode !== 'recents' && accessesError)

  const isEmptyInventory =
    mode === 'all' &&
    !isLoading &&
    clients.length === 0 &&
    allConnections.length === 0 &&
    allAccesses.length === 0

  const items = useMemo((): InventoryListItem[] => {
    let connectionItems: InventoryListItem[] = connections.map((connection) => ({
      kind: 'connection' as const,
      connection
    }))
    let accessItems: InventoryListItem[] =
      mode === 'recents' ? [] : accesses.map((access) => ({ kind: 'access' as const, access }))

    if (mode === 'recents') {
      const recentOnly = connectionItems.filter(
        (item): item is Extract<InventoryListItem, { kind: 'connection' }> =>
          item.kind === 'connection' && Boolean(item.connection.lastConnectedAt)
      )
      return recentOnly
        .sort((a, b) => {
          const aTime = a.connection.lastConnectedAt ? Date.parse(a.connection.lastConnectedAt) : 0
          const bTime = b.connection.lastConnectedAt ? Date.parse(b.connection.lastConnectedAt) : 0
          return bTime - aTime
        })
        .slice(0, 50)
    }

    if (kindFilter === 'connection') {
      accessItems = []
    } else if (kindFilter !== 'all') {
      connectionItems = []
      accessItems = accessItems.filter(
        (item): item is Extract<InventoryListItem, { kind: 'access' }> =>
          item.kind === 'access' && item.access.type === kindFilter
      )
    }

    const merged = [...connectionItems, ...accessItems]

    if (listSort === 'lastAccess') {
      return merged.sort((a, b) => {
        const aConn =
          a.kind === 'connection' && a.connection.lastConnectedAt
            ? Date.parse(a.connection.lastConnectedAt)
            : null
        const bConn =
          b.kind === 'connection' && b.connection.lastConnectedAt
            ? Date.parse(b.connection.lastConnectedAt)
            : null
        if (aConn !== null && bConn !== null && aConn !== bConn) return bConn - aConn
        if (aConn !== null && bConn === null) return -1
        if (aConn === null && bConn !== null) return 1
        const aCreated = a.kind === 'connection' ? a.connection.createdAt : a.access.createdAt
        const bCreated = b.kind === 'connection' ? b.connection.createdAt : b.access.createdAt
        const created = Date.parse(bCreated) - Date.parse(aCreated)
        if (created !== 0) return created
        const aName = a.kind === 'connection' ? a.connection.name : a.access.name
        const bName = b.kind === 'connection' ? b.connection.name : b.access.name
        return aName.localeCompare(bName, 'pt-BR')
      })
    }

    return merged.sort((a, b) => {
      const aName = a.kind === 'connection' ? a.connection.name : a.access.name
      const bName = b.kind === 'connection' ? b.connection.name : b.access.name
      return aName.localeCompare(bName, 'pt-BR')
    })
  }, [connections, accesses, mode, listSort, kindFilter])

  const countLabel = `${items.length} item${items.length === 1 ? '' : 's'}`
  const sortLabel = listSort === 'lastAccess' ? 'ordenados por último acesso' : 'ordenados por nome'
  const { title, subtitle, emptyTitle, emptyDescription } = describePage({
    mode,
    countLabel,
    sortLabel: mode === 'recents' ? undefined : sortLabel,
    clientName: client?.name,
    environmentName: environment?.name,
    groupName: group?.name,
    tagName: tag?.name,
    isEmptyInventory
  })

  function openCreateConnection(): void {
    openDialog({
      type: 'connection',
      mode: 'create',
      groupId: groupId ?? undefined,
      environmentId: environmentId ?? undefined,
      clientId
    })
  }

  function openCreateAccess(accessType?: AccessType): void {
    openDialog({
      type: 'access',
      mode: 'create',
      groupId: groupId ?? undefined,
      environmentId: environmentId ?? undefined,
      clientId,
      accessType
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="min-w-0">
          <h1 className="truncate text-[13px] font-medium text-foreground">{title}</h1>
          <p className="truncate text-[11px] text-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {mode !== 'recents' ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Filtrar tipo"
                    title="Filtrar"
                  >
                    <ListFilter className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuLabel>Tipo</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={kindFilter}
                    onValueChange={(value) => setKindFilter(value as KindFilter)}
                  >
                    <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="connection">Servidor</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="database">Banco</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="login">Login</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Ordenar lista"
                    title="Ordenar"
                  >
                    <ArrowUpDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Ordenar</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={listSort}
                    onValueChange={(value) => setListSort(value as 'name' | 'lastAccess')}
                  >
                    <DropdownMenuRadioItem value="name">Nome</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="lastAccess">Último acesso</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-7 gap-1 px-2.5 text-xs"
                title={`Novo (${shortcutDisplayLabel('newConnection')})`}
              >
                <Plus className="size-3.5" />
                Novo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={openCreateConnection}>Conexão</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openCreateAccess('login')}>
                Acesso · login
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openCreateAccess('database')}>
                Acesso · banco
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openCreateAccess('other')}>
                Acesso · outro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ConnectionList
          items={items}
          listSort={listSort}
          isLoading={isLoading}
          isError={isError}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyActionLabel={
            isEmptyInventory
              ? 'Criar primeira conexão'
              : mode === 'all'
                ? 'Nova conexão'
                : groupId
                  ? 'Nova conexão'
                  : undefined
          }
          onEmptyAction={
            isEmptyInventory || mode === 'all' || groupId ? openCreateConnection : undefined
          }
          emptySecondaryActionLabel={isEmptyInventory ? t('help.viewTutorial') : undefined}
          onEmptySecondaryAction={
            isEmptyInventory
              ? () => navigate('/settings/manual?chapter=getting-started')
              : undefined
          }
          createDefaults={{
            groupId: groupId ?? undefined,
            environmentId: environmentId ?? undefined,
            clientId
          }}
        />
      </ScrollArea>
    </div>
  )
}

function describePage({
  mode,
  countLabel,
  sortLabel,
  clientName,
  environmentName,
  groupName,
  tagName,
  isEmptyInventory
}: {
  mode: ListMode
  countLabel: string
  sortLabel?: string
  clientName?: string
  environmentName?: string
  groupName?: string
  tagName?: string
  isEmptyInventory?: boolean
}): {
  title: string
  subtitle: string
  emptyTitle: string
  emptyDescription: string
} {
  const withSort = (base: string): string => (sortLabel ? `${base} · ${sortLabel}` : base)

  if (mode === 'favorites') {
    return {
      title: 'Favoritos',
      subtitle: withSort(countLabel),
      emptyTitle: 'Nenhum favorito',
      emptyDescription: 'Marque conexões ou acessos com estrela para vê-los aqui.'
    }
  }

  if (mode === 'recents') {
    return {
      title: 'Recentes',
      subtitle: countLabel,
      emptyTitle: 'Sem acessos recentes',
      emptyDescription: 'Conexões usadas recentemente aparecerão aqui.'
    }
  }

  if (mode === 'tag') {
    return {
      title: tagName ?? 'Tag',
      subtitle: withSort(countLabel),
      emptyTitle: 'Nenhum item com esta tag',
      emptyDescription: 'Associe tags a conexões ou acessos para filtrá-los aqui.'
    }
  }

  if (mode === 'client') {
    const crumbs = [clientName, environmentName, groupName].filter(Boolean)
    return {
      title: crumbs[crumbs.length - 1] ?? 'Cliente',
      subtitle: withSort(crumbs.length > 1 ? `${crumbs.join(' / ')} · ${countLabel}` : countLabel),
      emptyTitle: 'Nenhum item neste filtro',
      emptyDescription: groupName
        ? 'Crie a primeira conexão ou acesso neste grupo.'
        : 'Ajuste o ambiente ou grupo na árvore lateral.'
    }
  }

  if (isEmptyInventory) {
    return {
      title: 'Conexões',
      subtitle: 'Comece cadastrando sua primeira conexão',
      emptyTitle: 'Bem-vindo ao North',
      emptyDescription:
        'Crie a primeira conexão ou acesso. Você pode cadastrar cliente, ambiente e grupo direto no formulário.'
    }
  }

  return {
    title: 'Conexões',
    subtitle: withSort(countLabel),
    emptyTitle: 'Nenhuma conexão',
    emptyDescription: 'Crie uma conexão ou acesso, ou selecione um grupo na árvore.'
  }
}
