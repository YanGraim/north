import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import type { ApiCollection, ApiFolder, ApiHttpMethod, ApiRequest } from '@shared/types'
import { ChevronDown, ChevronRight, FileText, Folder, FolderPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { filterCollectionTree } from './filter-collection-tree'

type CollectionsTreeProps = {
  collections: ApiCollection[]
  foldersByCollection: Record<string, ApiFolder[]>
  requestsByCollection: Record<string, ApiRequest[]>
  query?: string
  activeRequestId: string | null
  onOpenRequest: (request: ApiRequest) => void
  onCreateCollection: () => void
  onCreateFolder: (collectionId: string, parentFolderId: string | null) => void
  onCreateRequest: (collectionId: string, folderId: string | null) => void
  onRenameCollection: (collection: ApiCollection) => void
  onDeleteCollection: (collection: ApiCollection) => void
  onRenameFolder: (folder: ApiFolder) => void
  onDeleteFolder: (folder: ApiFolder) => void
  onRenameRequest: (request: ApiRequest) => void
  onDuplicateRequest: (request: ApiRequest) => void
  onDeleteRequest: (request: ApiRequest) => void
  onMoveRequest: (request: ApiRequest, collectionId: string, folderId: string | null) => void
  onExportCollection?: (collection: ApiCollection) => void
  onDuplicateCollection?: (collection: ApiCollection) => void
  onImport?: () => void
}

const METHOD_COLOR: Record<ApiHttpMethod, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-sky-400',
  PATCH: 'text-violet-400',
  DELETE: 'text-red-400',
  HEAD: 'text-muted',
  OPTIONS: 'text-muted'
}

export function CollectionsTree({
  collections,
  foldersByCollection,
  requestsByCollection,
  query = '',
  activeRequestId,
  onOpenRequest,
  onCreateCollection,
  onCreateFolder,
  onCreateRequest,
  onRenameCollection,
  onDeleteCollection,
  onRenameFolder,
  onDeleteFolder,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
  onMoveRequest,
  onExportCollection,
  onDuplicateCollection,
  onImport
}: CollectionsTreeProps): React.JSX.Element {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  function toggle(key: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const moveTargets = useMemo(() => {
    return collections.map((collection) => ({
      collection,
      folders: foldersByCollection[collection.id] ?? []
    }))
  }, [collections, foldersByCollection])

  const searching = query.trim().length > 0
  const filtered = useMemo(
    () => filterCollectionTree({ collections, foldersByCollection, requestsByCollection }, query),
    [collections, foldersByCollection, requestsByCollection, query]
  )
  const visibleCollections = searching ? filtered.collections : collections
  const visibleFolders = searching ? filtered.foldersByCollection : foldersByCollection
  const visibleRequests = searching ? filtered.requestsByCollection : requestsByCollection

  if (collections.length === 0) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <p className="text-xs text-muted">{t('api.studio.emptyCollections')}</p>
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={onCreateCollection}
            >
              {t('api.studio.newCollection')}
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onCreateCollection}>
            {t('api.studio.newCollection')}
          </ContextMenuItem>
          {onImport ? (
            <ContextMenuItem onSelect={onImport}>{t('api.transfer.importExport')}</ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  if (visibleCollections.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-xs text-muted">{t('api.studio.emptyEndpoints')}</p>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <ul className="p-1">
          {visibleCollections.map((collection) => {
            const open = searching
              ? filtered.expandedIds.has(collection.id)
              : expanded.has(collection.id) || expanded.size === 0
            const folders = visibleFolders[collection.id] ?? []
            const requests = visibleRequests[collection.id] ?? []
            return (
              <li key={collection.id}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-surface-elevated"
                      onClick={() => toggle(collection.id)}
                    >
                      {open ? (
                        <ChevronDown className="size-3 shrink-0" />
                      ) : (
                        <ChevronRight className="size-3 shrink-0" />
                      )}
                      <Folder className="size-3 shrink-0 text-muted" />
                      <span className="truncate">{collection.name}</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => onCreateRequest(collection.id, null)}>
                      {t('api.studio.newRequest')}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => onCreateFolder(collection.id, null)}>
                      <FolderPlus className="size-3.5" />
                      {t('api.studio.newFolder')}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => onRenameCollection(collection)}>
                      {t('common.edit')}
                    </ContextMenuItem>
                    {onDuplicateCollection ? (
                      <ContextMenuItem onSelect={() => onDuplicateCollection(collection)}>
                        {t('api.studio.duplicate')}
                      </ContextMenuItem>
                    ) : null}
                    {onExportCollection ? (
                      <ContextMenuItem onSelect={() => onExportCollection(collection)}>
                        {t('api.studio.export')}
                      </ContextMenuItem>
                    ) : null}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => onDeleteCollection(collection)}
                    >
                      {t('common.delete')}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                {open ? (
                  <FolderList
                    collectionId={collection.id}
                    parentId={null}
                    folders={folders}
                    requests={requests}
                    expanded={expanded}
                    searching={searching}
                    searchExpandedIds={filtered.expandedIds}
                    activeRequestId={activeRequestId}
                    moveTargets={moveTargets}
                    onToggle={toggle}
                    onOpenRequest={onOpenRequest}
                    onCreateFolder={onCreateFolder}
                    onCreateRequest={onCreateRequest}
                    onRenameFolder={onRenameFolder}
                    onDeleteFolder={onDeleteFolder}
                    onRenameRequest={onRenameRequest}
                    onDuplicateRequest={onDuplicateRequest}
                    onDeleteRequest={onDeleteRequest}
                    onMoveRequest={onMoveRequest}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}

type FolderListProps = {
  collectionId: string
  parentId: string | null
  folders: ApiFolder[]
  requests: ApiRequest[]
  expanded: Set<string>
  searching: boolean
  searchExpandedIds: Set<string>
  activeRequestId: string | null
  moveTargets: Array<{ collection: ApiCollection; folders: ApiFolder[] }>
  onToggle: (key: string) => void
  onOpenRequest: (request: ApiRequest) => void
  onCreateFolder: (collectionId: string, parentFolderId: string | null) => void
  onCreateRequest: (collectionId: string, folderId: string | null) => void
  onRenameFolder: (folder: ApiFolder) => void
  onDeleteFolder: (folder: ApiFolder) => void
  onRenameRequest: (request: ApiRequest) => void
  onDuplicateRequest: (request: ApiRequest) => void
  onDeleteRequest: (request: ApiRequest) => void
  onMoveRequest: (request: ApiRequest, collectionId: string, folderId: string | null) => void
}

function FolderList(props: FolderListProps): React.JSX.Element {
  const { t } = useTranslation()
  const childFolders = props.folders.filter((folder) => folder.parentFolderId === props.parentId)
  const childRequests = props.requests.filter((request) => request.folderId === props.parentId)

  return (
    <ul className="ml-3 border-l border-border/60 pl-1">
      {childFolders.map((folder) => {
        const open = props.searching
          ? props.searchExpandedIds.has(folder.id)
          : props.expanded.has(folder.id)
        return (
          <li key={folder.id}>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-1 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-surface-elevated"
                  onClick={() => props.onToggle(folder.id)}
                >
                  {open ? (
                    <ChevronDown className="size-3 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0" />
                  )}
                  <Folder className="size-3 shrink-0 text-muted" />
                  <span className="truncate">{folder.name}</span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onSelect={() => props.onCreateRequest(props.collectionId, folder.id)}
                >
                  {t('api.studio.newRequest')}
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => props.onCreateFolder(props.collectionId, folder.id)}
                >
                  {t('api.studio.newFolder')}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => props.onRenameFolder(folder)}>
                  {t('common.edit')}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => props.onDeleteFolder(folder)}
                >
                  {t('common.delete')}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {open ? <FolderList {...props} parentId={folder.id} /> : null}
          </li>
        )
      })}
      {childRequests.map((request) => (
        <li key={request.id}>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-surface-elevated',
                  props.activeRequestId === request.id && 'bg-surface-elevated text-foreground'
                )}
                onClick={() => props.onOpenRequest(request)}
              >
                <FileText className="size-3 shrink-0 text-muted" />
                <span
                  className={cn(
                    'w-10 shrink-0 font-mono text-[10px]',
                    METHOD_COLOR[request.method]
                  )}
                >
                  {request.method}
                </span>
                <span className="truncate">{request.name}</span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => props.onOpenRequest(request)}>
                {t('api.studio.open')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => props.onDuplicateRequest(request)}>
                {t('api.studio.duplicate')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => props.onRenameRequest(request)}>
                {t('common.edit')}
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>{t('api.studio.move')}</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {props.moveTargets.map(({ collection, folders }) => (
                    <ContextMenuSub key={collection.id}>
                      <ContextMenuSubTrigger>{collection.name}</ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        <ContextMenuItem
                          onSelect={() => props.onMoveRequest(request, collection.id, null)}
                        >
                          {t('api.studio.collectionRoot')}
                        </ContextMenuItem>
                        {folders.map((folder) => (
                          <ContextMenuItem
                            key={folder.id}
                            onSelect={() => props.onMoveRequest(request, collection.id, folder.id)}
                          >
                            {folder.name}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onSelect={() => props.onDeleteRequest(request)}
              >
                {t('common.delete')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </li>
      ))}
    </ul>
  )
}
