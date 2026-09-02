import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { NameDialog } from '@renderer/components/NameDialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useApiCollections, useDeleteApiCollection } from '@renderer/hooks/use-api'
import { useClients } from '@renderer/hooks/use-clients'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { openApiStudioTab } from '@renderer/stores/sessions-store'
import { useUiStore } from '@renderer/stores/ui-store'
import type { ApiCollection } from '@shared/types'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, FolderPlus, Globe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ROW_IDLE = 'text-muted hover:bg-surface-elevated/40 hover:text-foreground'
const ROW =
  'flex h-8 min-w-0 w-full items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors motion-safe:duration-150'

type NameTarget = { kind: 'rename'; collection: ApiCollection }

type ApisTreeProps = {
  collapsed: boolean
  onCreate: () => void
  onImport: () => void
}

export function ApisTree({ collapsed, onCreate, onImport }: ApisTreeProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: collections = [], isLoading, isError, error } = useApiCollections()
  const { data: clients = [] } = useClients()
  const deleteCollection = useDeleteApiCollection()
  const expandedNodes = useUiStore((s) => s.expandedTreeNodes)
  const setTreeNodeExpanded = useUiStore((s) => s.setTreeNodeExpanded)
  const [nameTarget, setNameTarget] = useState<NameTarget | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ApiCollection | null>(null)

  const globals = useMemo(
    () => collections.filter((collection) => collection.clientId === null),
    [collections]
  )
  const byClient = useMemo(() => {
    const map = new Map<string, ApiCollection[]>()
    for (const collection of collections) {
      if (!collection.clientId) continue
      const list = map.get(collection.clientId) ?? []
      list.push(collection)
      map.set(collection.clientId, list)
    }
    return clients
      .map((client) => ({ client, collections: map.get(client.id) ?? [] }))
      .filter((entry) => entry.collections.length > 0)
  }, [clients, collections])

  function openCollection(collection: ApiCollection): void {
    openApiStudioTab({
      collectionId: collection.id,
      collectionName: collection.name,
      clientId: collection.clientId,
      title: collection.name
    })
  }

  async function handleExport(collection: ApiCollection): Promise<void> {
    try {
      const result = await window.north.api.collectionExport(collection.id)
      if (!result.canceled) toastSuccess(t('api.studio.exported'))
    } catch (error) {
      toastError(error, t('api.studio.exportError'))
    }
  }

  async function handleDuplicate(collection: ApiCollection): Promise<void> {
    try {
      const copy = await window.north.api.collectionDuplicate(collection.id)
      await queryClient.invalidateQueries({ queryKey: ['api', 'collections'] })
      toastSuccess(t('api.studio.duplicated'))
      openCollection(copy)
    } catch (error) {
      toastError(error, t('api.studio.duplicateError'))
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-elevated/40 hover:text-foreground"
        aria-label={t('nav.apis')}
        onClick={() => openApiStudioTab({ title: t('nav.apis') })}
      >
        <Globe className="size-3.5" />
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 px-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    )
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex flex-col gap-0.5">
            {isError ? <p className="px-2 py-1.5 text-xs text-muted">{error.message}</p> : null}
            {globals.length > 0 ? (
              <TreeGroup
                label={t('api.globals')}
                expanded={expandedNodes['api-global'] ?? true}
                onToggle={() =>
                  setTreeNodeExpanded('api-global', !(expandedNodes['api-global'] ?? true))
                }
                collections={globals}
                onOpen={openCollection}
                onExport={(collection) => void handleExport(collection)}
                onDuplicate={(collection) => void handleDuplicate(collection)}
                onRename={(collection) => setNameTarget({ kind: 'rename', collection })}
                onDelete={setPendingDelete}
              />
            ) : null}
            {byClient.map(({ client, collections: clientCollections }) => {
              const key = `api-client:${client.id}`
              return (
                <TreeGroup
                  key={client.id}
                  label={client.name}
                  expanded={expandedNodes[key] ?? true}
                  onToggle={() => setTreeNodeExpanded(key, !(expandedNodes[key] ?? true))}
                  collections={clientCollections}
                  onOpen={openCollection}
                  onExport={(collection) => void handleExport(collection)}
                  onDuplicate={(collection) => void handleDuplicate(collection)}
                  onRename={(collection) => setNameTarget({ kind: 'rename', collection })}
                  onDelete={setPendingDelete}
                />
              )
            })}
            {collections.length === 0 ? (
              <button type="button" className={cn(ROW, ROW_IDLE)} onClick={onCreate}>
                <FolderPlus className="size-3.5 shrink-0" />
                <span className="truncate">{t('api.studio.newCollection')}</span>
              </button>
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onCreate}>{t('api.studio.newCollection')}</ContextMenuItem>
          <ContextMenuItem onSelect={onImport}>{t('api.transfer.importExport')}</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <NameDialog
        open={nameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setNameTarget(null)
        }}
        title={t('common.edit')}
        defaultValue={nameTarget?.collection.name ?? ''}
        confirmLabel={t('common.save')}
        onSubmit={(input) => {
          if (!nameTarget) return
          void window.north.api
            .collectionUpdate(nameTarget.collection.id, { name: input.name })
            .then(async () => {
              await queryClient.invalidateQueries({ queryKey: ['api', 'collections'] })
            })
            .catch((error: unknown) => toastError(error, t('api.studio.saveCollectionError')))
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t('api.dialogs.deleteCollection', { name: pendingDelete?.name ?? '' })}
        description={t('api.dialogs.deleteBody')}
        confirming={deleteCollection.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await deleteCollection.mutateAsync({ id: pendingDelete.id })
          setPendingDelete(null)
        }}
      />
    </>
  )
}

type TreeGroupProps = {
  label: string
  expanded: boolean
  onToggle: () => void
  collections: ApiCollection[]
  onOpen: (collection: ApiCollection) => void
  onExport: (collection: ApiCollection) => void
  onDuplicate: (collection: ApiCollection) => void
  onRename: (collection: ApiCollection) => void
  onDelete: (collection: ApiCollection) => void
}

function TreeGroup({
  label,
  expanded,
  onToggle,
  collections,
  onOpen,
  onExport,
  onDuplicate,
  onRename,
  onDelete
}: TreeGroupProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div>
      <button type="button" className={cn(ROW, ROW_IDLE)} onClick={onToggle}>
        <ChevronRight
          className={cn('size-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
        />
        <Globe className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {expanded
        ? collections.map((collection) => (
            <ContextMenu key={collection.id}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(ROW, ROW_IDLE, 'pl-6')}
                  onClick={() => onOpen(collection)}
                >
                  <Globe className="size-3.5 shrink-0" />
                  <span className="truncate">{collection.name}</span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => onOpen(collection)}>
                  {t('api.studio.open')}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onExport(collection)}>
                  {t('api.studio.export')}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onDuplicate(collection)}>
                  {t('api.studio.duplicate')}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onRename(collection)}>
                  {t('common.edit')}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onSelect={() => onDelete(collection)}>
                  {t('common.delete')}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))
        : null}
    </div>
  )
}
