import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { EmptyState } from '@renderer/components/EmptyState'
import { NameDialog } from '@renderer/components/NameDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button, buttonVariants } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Input } from '@renderer/components/ui/input'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { toast } from '@renderer/components/ui/sonner'
import { CollectionTransferDialog } from '@renderer/features/api/CollectionTransferDialog'
import { SessionIdentityBar } from '@renderer/features/sessions/SessionIdentityBar'
import { useAccesses } from '@renderer/hooks/use-accesses'
import {
  useApiCollections,
  useApiHistory,
  useCreateApiCollection,
  useCreateApiFolder,
  useCreateApiRequest,
  useDeleteApiCollection,
  useDeleteApiFolder,
  useDeleteApiRequest,
  useDeleteApiVariable,
  useDuplicateApiRequest,
  useMoveApiRequest,
  useSetApiVariable,
  useUpdateApiCollection,
  useUpdateApiFolder,
  useUpdateApiRequest
} from '@renderer/hooks/use-api'
import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { queryKeys } from '@renderer/lib/query-keys'
import { releaseStaleBodyPointerEvents } from '@renderer/lib/release-body-pointer-events'
import { matchesShortcut } from '@renderer/lib/shortcuts'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import type { ApiCollection, ApiFolder, ApiRequest, ApiRequestHistoryEntry } from '@shared/types'
import { emptyApiRequestDefinition } from '@shared/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderInput, Globe, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDefaultLayout } from 'react-resizable-panels'
import { type ApiStudioTab, emptyScratchTab, neighborTabId } from '../api-studio-tabs'
import { ApiHistoryPanel } from './ApiHistoryPanel'
import { ApiStudioTabBar } from './ApiStudioTabBar'
import { ApiVariablesPanel } from './ApiVariablesPanel'
import { CollectionsTree } from './CollectionsTree'
import { RequestEditor } from './RequestEditor'
import { ResponseViewer } from './ResponseViewer'

type SidebarPane = 'collections' | 'history' | 'variables'

type ApiStudioViewProps = {
  collectionId?: string | null
  environmentAccessId?: string | null
  clientId?: string | null
  visible: boolean
  title?: string
  host?: string | null
  environmentName?: string | null
  environmentColor?: string | null
}

export function ApiStudioView({
  collectionId,
  environmentAccessId: initialEnvironmentId,
  clientId,
  visible,
  title,
  host,
  environmentName,
  environmentColor
}: ApiStudioViewProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { resolveGroup } = useOrgLookup()
  const { data: allCollections = [] } = useApiCollections()
  const focused = collectionId ? allCollections.find((item) => item.id === collectionId) : undefined
  const scopeClientId = focused?.clientId ?? clientId ?? null
  const collections =
    scopeClientId == null
      ? allCollections
      : allCollections.filter((item) => item.clientId === null || item.clientId === scopeClientId)
  const { data: envAccesses = [] } = useAccesses(
    scopeClientId ? { clientId: scopeClientId, type: 'api' } : { type: 'api' }
  )
  const [environmentAccessId, setEnvironmentAccessId] = useState(initialEnvironmentId ?? '')
  const environmentTriggerRef = useRef<HTMLButtonElement>(null)
  const [nameKind, setNameKind] = useState<
    'collection' | 'folder' | 'rename-collection' | 'rename-folder' | 'rename-request' | null
  >(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [nameSeed, setNameSeed] = useState('')
  const [folderParent, setFolderParent] = useState<{
    collectionId: string
    parentFolderId: string | null
  } | null>(null)
  const [renameTarget, setRenameTarget] = useState<
    | { kind: 'collection'; collection: ApiCollection }
    | { kind: 'folder'; folder: ApiFolder }
    | { kind: 'request'; request: ApiRequest }
    | null
  >(null)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'collection'; collection: ApiCollection }
    | { kind: 'folder'; folder: ApiFolder }
    | { kind: 'request'; request: ApiRequest }
    | null
  >(null)
  const collectionIds = collections.map((item) => item.id)
  const treeQuery = useQuery({
    queryKey: ['api', 'tree', collectionIds],
    queryFn: async () => {
      const folders: Record<string, ApiFolder[]> = {}
      const requests: Record<string, ApiRequest[]> = {}
      await Promise.all(
        collectionIds.map(async (id) => {
          folders[id] = await window.north.api.folderList(id)
          requests[id] = await window.north.api.requestList(id)
        })
      )
      return { folders, requests }
    },
    enabled: collectionIds.length > 0
  })
  const { data: history = [], refetch: refetchHistory } = useApiHistory(
    environmentAccessId || undefined
  )
  const { data: variables = [] } = useQuery({
    queryKey: queryKeys.api.variables(environmentAccessId),
    queryFn: () => window.north.api.variableList(environmentAccessId),
    enabled: Boolean(environmentAccessId)
  })

  const createCollection = useCreateApiCollection()
  const updateCollection = useUpdateApiCollection()
  const deleteCollection = useDeleteApiCollection()
  const createFolder = useCreateApiFolder()
  const updateFolder = useUpdateApiFolder()
  const deleteFolder = useDeleteApiFolder()
  const createRequest = useCreateApiRequest()
  const updateRequest = useUpdateApiRequest()
  const deleteRequest = useDeleteApiRequest()
  const duplicateRequest = useDuplicateApiRequest()
  const moveRequest = useMoveApiRequest()
  const setVariable = useSetApiVariable()
  const deleteVariable = useDeleteApiVariable()

  const [tabs, setTabs] = useState<ApiStudioTab[]>(() => [
    emptyScratchTab(t('api.studio.newRequest'))
  ])
  const [activeId, setActiveId] = useState<string>(() => tabs[0]?.id ?? '')
  const [sidebar, setSidebar] = useState<SidebarPane>('collections')
  const [collectionQuery, setCollectionQuery] = useState('')
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)
  const tabsRef = useRef(tabs)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'north-api-studio-h',
    storage: localStorage
  })

  tabsRef.current = tabs
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null

  useEffect(() => {
    if (initialEnvironmentId) setEnvironmentAccessId(initialEnvironmentId)
  }, [initialEnvironmentId])

  const patchTab = useCallback((id: string, updater: (tab: ApiStudioTab) => ApiStudioTab): void => {
    setTabs((current) => current.map((tab) => (tab.id === id ? updater(tab) : tab)))
  }, [])

  function openRequest(request: ApiRequest): void {
    const existing = tabsRef.current.find((tab) => tab.requestId === request.id)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const next: ApiStudioTab = {
      id: crypto.randomUUID(),
      requestId: request.id,
      name: request.name,
      method: request.method,
      url: request.url,
      definition: request.definition,
      dirty: false,
      response: null,
      error: null,
      sending: false,
      inFlightRequestId: null
    }
    setTabs((current) => [...current, next])
    setActiveId(next.id)
  }

  function openHistory(entry: ApiRequestHistoryEntry): void {
    if (entry.requestId) {
      const found = Object.values(treeQuery.data?.requests ?? {})
        .flat()
        .find((request) => request.id === entry.requestId)
      if (found) {
        openRequest(found)
        return
      }
    }
    const next = emptyScratchTab(t('api.studio.newRequest'))
    next.method = entry.method
    next.url = entry.url
    setTabs((current) => [...current, next])
    setActiveId(next.id)
  }

  const sendActive = useCallback(async (): Promise<void> => {
    const tab = tabsRef.current.find((item) => item.id === activeId)
    if (!tab || tab.sending) return
    if (!environmentAccessId) {
      toast.error(t('api.studio.selectEnvironment'))
      environmentTriggerRef.current?.focus()
      return
    }
    const requestId = crypto.randomUUID()
    patchTab(tab.id, (current) => ({
      ...current,
      sending: true,
      error: null,
      inFlightRequestId: requestId
    }))
    try {
      const result = await window.north.api.send({
        requestId,
        method: tab.method,
        url: tab.url,
        definition: tab.definition,
        environmentAccessId,
        persistedRequestId: tab.requestId,
        collectionId: collectionId ?? collections[0]?.id
      })
      patchTab(tab.id, (current) => ({
        ...current,
        sending: false,
        inFlightRequestId: null,
        response: result,
        error: result.errorKind ? result.errorMessage : null
      }))
      void refetchHistory()
    } catch (error) {
      patchTab(tab.id, (current) => ({
        ...current,
        sending: false,
        inFlightRequestId: null,
        error: error instanceof Error ? error.message : t('api.errors.network')
      }))
    }
  }, [activeId, collectionId, collections, environmentAccessId, patchTab, refetchHistory, t])

  const saveTab = useCallback(
    async (tab: ApiStudioTab): Promise<boolean> => {
      try {
        if (tab.requestId) {
          const collectionId =
            Object.entries(treeQuery.data?.requests ?? {}).find(([, list]) =>
              list.some((request) => request.id === tab.requestId)
            )?.[0] ?? collections[0]?.id
          if (!collectionId) return false
          await updateRequest.mutateAsync({
            id: tab.requestId,
            collectionId,
            input: {
              name: tab.name,
              method: tab.method,
              url: tab.url,
              definition: tab.definition
            }
          })
          patchTab(tab.id, (current) => ({ ...current, dirty: false }))
          toastSuccess(t('api.studio.saved'))
          return true
        }
        const collection = collections[0]
        if (!collection) {
          toast.error(t('api.studio.emptyCollections'))
          return false
        }
        const created = await createRequest.mutateAsync({
          collectionId: collection.id,
          name: tab.name,
          method: tab.method,
          url: tab.url,
          definition: tab.definition
        })
        patchTab(tab.id, (current) => ({
          ...current,
          requestId: created.id,
          dirty: false
        }))
        toastSuccess(t('api.studio.saved'))
        return true
      } catch (error) {
        toastError(error, t('api.studio.saveRequestError'))
        return false
      }
    },
    [collections, createRequest, patchTab, t, treeQuery.data?.requests, updateRequest]
  )

  const saveActive = useCallback(async (): Promise<void> => {
    const tab = tabsRef.current.find((item) => item.id === activeId)
    if (!tab) return
    await saveTab(tab)
  }, [activeId, saveTab])

  function closeTab(id: string): void {
    const nextActive = neighborTabId(tabsRef.current, id, activeId)
    setTabs((current) => current.filter((tab) => tab.id !== id))
    setActiveId(nextActive ?? '')
  }

  function requestClose(id: string): void {
    const tab = tabsRef.current.find((item) => item.id === id)
    if (tab?.dirty) {
      setPendingCloseId(id)
      return
    }
    closeTab(id)
  }

  async function saveAndClose(): Promise<void> {
    const id = pendingCloseId
    if (!id) return
    const tab = tabsRef.current.find((item) => item.id === id)
    if (!tab) {
      setPendingCloseId(null)
      return
    }
    const ok = await saveTab(tab)
    if (!ok) return
    closeTab(id)
    setPendingCloseId(null)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!visible) return
      if (matchesShortcut(event, 'sendRequest')) {
        event.preventDefault()
        void sendActive()
        return
      }
      if (matchesShortcut(event, 'saveRequest')) {
        event.preventDefault()
        event.stopPropagation()
        void saveActive()
        return
      }
      if (matchesShortcut(event, 'focusUrl')) {
        event.preventDefault()
        urlInputRef.current?.focus()
        urlInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [saveActive, sendActive, visible])

  useEffect(() => {
    if (visible) {
      window.setTimeout(releaseStaleBodyPointerEvents, 0)
      return
    }
    setTransferOpen(false)
    setPendingDelete(null)
    setNameKind(null)
    setPendingCloseId(null)
    window.setTimeout(releaseStaleBodyPointerEvents, 0)
  }, [visible])

  const folderLabel = title || t('api.studio.title')
  const canSend = Boolean(activeTab && !activeTab.sending)
  const foldersByCollection = treeQuery.data?.folders ?? {}
  const requestsByCollection = treeQuery.data?.requests ?? {}
  const defaultCollectionId = collectionId ?? collections[0]?.id

  async function invalidateTree(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['api', 'tree'] })
    await queryClient.invalidateQueries({ queryKey: ['api', 'collections'] })
  }

  function envLabel(access: (typeof envAccesses)[number]): string {
    const environment = resolveGroup(access.groupId).environment
    return environment?.name ? `${environment.name} — ${access.name}` : access.name
  }

  async function handleExport(collection: ApiCollection): Promise<void> {
    try {
      const result = await window.north.api.collectionExport(collection.id)
      if (!result.canceled) toastSuccess(t('api.studio.exported'))
    } catch (error) {
      toastError(error, t('api.studio.exportError'))
    }
  }

  async function handleDuplicateCollection(collection: ApiCollection): Promise<void> {
    try {
      await window.north.api.collectionDuplicate(collection.id)
      await invalidateTree()
      toastSuccess(t('api.studio.duplicated'))
    } catch (error) {
      toastError(error, t('api.studio.duplicateError'))
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      style={{ display: visible ? 'flex' : 'none' }}
      data-testid="api-studio"
    >
      <SessionIdentityBar
        host={host}
        folderLabel={folderLabel}
        environmentName={environmentName}
        environmentColor={environmentColor}
      >
        <Select value={environmentAccessId || undefined} onValueChange={setEnvironmentAccessId}>
          <SelectTrigger
            ref={environmentTriggerRef}
            className="h-7 w-56 text-xs"
            data-testid="api-environment"
          >
            <SelectValue placeholder={t('api.studio.selectEnvironment')} />
          </SelectTrigger>
          <SelectContent>
            {envAccesses.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {envLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SessionIdentityBar>

      <ResizablePanelGroup
        id="north-api-studio-h"
        orientation="horizontal"
        className="min-h-0 flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <ResizablePanel id="api-tree" defaultSize="22%" minSize="14%" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 gap-0.5 border-b border-border p-0.5">
              {(['collections', 'history', 'variables'] as const).map((pane) => (
                <button
                  key={pane}
                  type="button"
                  className={cn(
                    'h-5 flex-1 rounded-sm px-1 text-[10px] font-medium',
                    sidebar === pane
                      ? 'bg-surface-elevated text-foreground'
                      : 'text-muted hover:text-foreground'
                  )}
                  onClick={() => setSidebar(pane)}
                >
                  {t(`api.studio.${pane}`)}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {sidebar === 'collections' ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex shrink-0 items-center gap-1 border-b border-border px-1 py-1">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute top-1/2 left-1.5 size-3 -translate-y-1/2 text-muted" />
                      <Input
                        value={collectionQuery}
                        onChange={(event) => setCollectionQuery(event.target.value)}
                        placeholder={t('api.studio.searchEndpoints')}
                        aria-label={t('api.studio.searchEndpoints')}
                        className="h-7 pl-6 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={t('api.transfer.importExport')}
                      onClick={() => setTransferOpen(true)}
                    >
                      <FolderInput className="size-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={t('api.studio.add')}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onSelect={() => {
                            setNameKind('collection')
                            setNameSeed(t('api.studio.newCollection'))
                          }}
                        >
                          {t('api.studio.newCollection')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            if (!defaultCollectionId) {
                              setNameKind('collection')
                              setNameSeed(t('api.studio.newCollection'))
                              return
                            }
                            setFolderParent({
                              collectionId: defaultCollectionId,
                              parentFolderId: null
                            })
                            setNameKind('folder')
                            setNameSeed(t('api.studio.newFolder'))
                          }}
                        >
                          {t('api.studio.newFolder')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            if (!defaultCollectionId) {
                              setNameKind('collection')
                              setNameSeed(t('api.studio.newCollection'))
                              return
                            }
                            void createRequest
                              .mutateAsync({
                                collectionId: defaultCollectionId,
                                folderId: null,
                                name: t('api.studio.newRequest'),
                                method: 'GET',
                                url: '',
                                definition: emptyApiRequestDefinition()
                              })
                              .then((request) => {
                                void invalidateTree()
                                openRequest(request)
                              })
                          }}
                        >
                          {t('api.studio.newRequest')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CollectionsTree
                    collections={collections}
                    foldersByCollection={foldersByCollection}
                    requestsByCollection={requestsByCollection}
                    query={collectionQuery}
                    activeRequestId={activeTab?.requestId ?? null}
                    onOpenRequest={openRequest}
                    onCreateCollection={() => {
                      setNameKind('collection')
                      setNameSeed(t('api.studio.newCollection'))
                    }}
                    onImport={() => setTransferOpen(true)}
                    onExportCollection={(collection) => void handleExport(collection)}
                    onDuplicateCollection={(collection) =>
                      void handleDuplicateCollection(collection)
                    }
                    onCreateFolder={(targetCollectionId, parentFolderId) => {
                      setFolderParent({ collectionId: targetCollectionId, parentFolderId })
                      setNameKind('folder')
                      setNameSeed(t('api.studio.newFolder'))
                    }}
                    onCreateRequest={(collectionId, folderId) => {
                      void createRequest
                        .mutateAsync({
                          collectionId,
                          folderId,
                          name: t('api.studio.newRequest'),
                          method: 'GET',
                          url: '',
                          definition: emptyApiRequestDefinition()
                        })
                        .then((request) => {
                          void invalidateTree()
                          openRequest(request)
                        })
                    }}
                    onRenameCollection={(collection: ApiCollection) => {
                      setRenameTarget({ kind: 'collection', collection })
                      setNameKind('rename-collection')
                      setNameSeed(collection.name)
                    }}
                    onDeleteCollection={(collection) =>
                      setPendingDelete({ kind: 'collection', collection })
                    }
                    onRenameFolder={(folder) => {
                      setRenameTarget({ kind: 'folder', folder })
                      setNameKind('rename-folder')
                      setNameSeed(folder.name)
                    }}
                    onDeleteFolder={(folder) => setPendingDelete({ kind: 'folder', folder })}
                    onRenameRequest={(request) => {
                      setRenameTarget({ kind: 'request', request })
                      setNameKind('rename-request')
                      setNameSeed(request.name)
                    }}
                    onDeleteRequest={(request) => setPendingDelete({ kind: 'request', request })}
                    onDuplicateRequest={(request) =>
                      duplicateRequest.mutate(request.id, {
                        onSuccess: (copy) => {
                          void invalidateTree()
                          openRequest(copy)
                        }
                      })
                    }
                    onMoveRequest={(request, collectionId, folderId) => {
                      moveRequest.mutate(
                        { requestId: request.id, collectionId, folderId },
                        { onSuccess: () => void invalidateTree() }
                      )
                    }}
                  />
                </div>
              ) : null}
              {sidebar === 'history' ? (
                <ApiHistoryPanel entries={history} onOpen={openHistory} />
              ) : null}
              {sidebar === 'variables' ? (
                <ApiVariablesPanel
                  variables={variables}
                  onSet={(input) => setVariable.mutate({ accessId: environmentAccessId, ...input })}
                  onDelete={(id) => deleteVariable.mutate({ id, accessId: environmentAccessId })}
                />
              ) : null}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="api-work" defaultSize="78%" minSize="40%" className="min-w-0">
          {tabs.length === 0 ? (
            <EmptyState icon={Globe} title={t('api.studio.empty')} />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <ApiStudioTabBar
                tabs={tabs}
                activeId={activeTab?.id ?? null}
                sending={Boolean(activeTab?.sending)}
                canSend={canSend}
                onActivate={setActiveId}
                onClose={requestClose}
                onNew={() => {
                  const next = emptyScratchTab(t('api.studio.newRequest'))
                  setTabs((current) => [...current, next])
                  setActiveId(next.id)
                }}
                onSend={() => void sendActive()}
                onCancel={() => {
                  if (!activeTab?.inFlightRequestId) return
                  void window.north.api.cancel({
                    requestId: activeTab.inFlightRequestId
                  })
                }}
              />
              {activeTab ? (
                <ResizablePanelGroup orientation="vertical" className="h-full min-h-0 flex-1">
                  <ResizablePanel id={`req-${activeTab.id}`} defaultSize="48%" minSize="20%">
                    <RequestEditor
                      method={activeTab.method}
                      url={activeTab.url}
                      definition={activeTab.definition}
                      urlInputRef={urlInputRef}
                      onMethodChange={(method) =>
                        patchTab(activeTab.id, (tab) => ({ ...tab, method, dirty: true }))
                      }
                      onUrlChange={(url) =>
                        patchTab(activeTab.id, (tab) => ({ ...tab, url, dirty: true }))
                      }
                      onDefinitionChange={(definition) =>
                        patchTab(activeTab.id, (tab) => ({ ...tab, definition, dirty: true }))
                      }
                    />
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel id={`res-${activeTab.id}`} defaultSize="52%" minSize="20%">
                    <ResponseViewer
                      response={activeTab.response}
                      error={activeTab.error}
                      sending={activeTab.sending}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <EmptyState icon={Globe} title={t('api.studio.empty')} />
              )}
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <NameDialog
        open={nameKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNameKind(null)
            setRenameTarget(null)
            setFolderParent(null)
          }
        }}
        title={
          nameKind === 'folder' || nameKind === 'rename-folder'
            ? t('api.studio.newFolder')
            : nameKind === 'rename-request'
              ? t('common.edit')
              : t('api.studio.newCollection')
        }
        defaultValue={nameSeed}
        confirmLabel={t('common.save')}
        onSubmit={({ name }) => {
          if (nameKind === 'collection') {
            createCollection.mutate({ clientId: scopeClientId, name })
            return
          }
          if (nameKind === 'folder' && folderParent) {
            createFolder.mutate(
              {
                collectionId: folderParent.collectionId,
                parentFolderId: folderParent.parentFolderId,
                name
              },
              { onSuccess: () => void invalidateTree() }
            )
            return
          }
          if (renameTarget?.kind === 'collection') {
            updateCollection.mutate({ id: renameTarget.collection.id, input: { name } })
            return
          }
          if (renameTarget?.kind === 'folder') {
            updateFolder.mutate(
              {
                id: renameTarget.folder.id,
                collectionId: renameTarget.folder.collectionId,
                input: { name }
              },
              { onSuccess: () => void invalidateTree() }
            )
            return
          }
          if (renameTarget?.kind === 'request') {
            updateRequest.mutate(
              {
                id: renameTarget.request.id,
                collectionId: renameTarget.request.collectionId,
                input: { name }
              },
              { onSuccess: () => void invalidateTree() }
            )
          }
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={
          pendingDelete?.kind === 'folder'
            ? t('api.dialogs.deleteFolder', { name: pendingDelete.folder.name })
            : pendingDelete?.kind === 'request'
              ? t('api.dialogs.deleteRequest', { name: pendingDelete.request.name })
              : t('api.dialogs.deleteCollection', { name: pendingDelete?.collection.name ?? '' })
        }
        description={t('api.dialogs.deleteBody')}
        confirming={deleteCollection.isPending || deleteFolder.isPending || deleteRequest.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          if (pendingDelete.kind === 'collection') {
            await deleteCollection.mutateAsync({ id: pendingDelete.collection.id })
          } else if (pendingDelete.kind === 'folder') {
            await deleteFolder.mutateAsync({
              id: pendingDelete.folder.id,
              collectionId: pendingDelete.folder.collectionId
            })
          } else {
            await deleteRequest.mutateAsync({
              id: pendingDelete.request.id,
              collectionId: pendingDelete.request.collectionId
            })
          }
          await invalidateTree()
          setPendingDelete(null)
        }}
      />
      <CollectionTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        defaultClientId={scopeClientId}
      />
      <AlertDialog
        open={pendingCloseId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCloseId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('api.dialogs.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('api.dialogs.unsavedDescription', {
                name: tabs.find((tab) => tab.id === pendingCloseId)?.name ?? ''
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (pendingCloseId) closeTab(pendingCloseId)
                setPendingCloseId(null)
              }}
            >
              {t('api.dialogs.discard')}
            </Button>
            <AlertDialogAction
              className={buttonVariants({ variant: 'default' })}
              onClick={(event) => {
                event.preventDefault()
                void saveAndClose()
              }}
            >
              {t('common.save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
