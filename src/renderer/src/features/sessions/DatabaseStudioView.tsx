import { Button } from '@renderer/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import { Switch } from '@renderer/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { QueryResultPane } from '@renderer/features/sessions/QueryResultPane'
import {
  collectUpdatePayloads,
  emptyGridDraft,
  type GridDraft,
  hasDirtyDraft
} from '@renderer/features/sessions/query-result-grid'
import { SchemaTree } from '@renderer/features/sessions/SchemaTree'
import { SessionIdentityBar } from '@renderer/features/sessions/SessionIdentityBar'
import { SqlEditor, type SqlEditorHandle } from '@renderer/features/sessions/SqlEditor'
import { StudioTabBar } from '@renderer/features/sessions/StudioTabBar'
import { TableDataPane } from '@renderer/features/sessions/TableDataPane'
import { toastError } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import {
  isFullSqlStatement,
  primaryKeyLookupSql,
  TABLE_BROWSE_PAGE_SIZE,
  TABLE_BROWSE_SOFT_CAP,
  tableBrowsePageSql
} from '@shared/lib/sql-ident'
import {
  filterChangesToTableColumns,
  findRelation,
  parsePrimaryFromRelation,
  resolveUpdatableTarget,
  type UpdatableQueryReason
} from '@shared/lib/sql-updatable-query'
import { buildMutationStatements, primaryKeyColumnNames } from '@shared/lib/sql-update'
import type {
  DatabaseIntrospection,
  DatabaseQueryResult,
  DatabaseRelation,
  DatabaseTxState,
  SqlStudioEngine
} from '@shared/protocols'
import { isSqlStudioEngine } from '@shared/protocols'
import { Check, RefreshCw, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  emptyQueryTab,
  neighborTabId,
  type QueryStudioTab,
  resolveOpenTable,
  type StudioPane,
  type StudioTab,
  type TableStudioTab
} from './studio-tabs'

type DatabaseStudioViewProps = {
  sessionId: string
  protocol?: string
  visible: boolean
  title?: string
  username?: string | null
  host?: string | null
  environmentName?: string | null
  environmentColor?: string | null
}

export function DatabaseStudioView({
  sessionId,
  protocol,
  visible,
  title,
  username,
  host,
  environmentName,
  environmentColor
}: DatabaseStudioViewProps): React.JSX.Element {
  const { t } = useTranslation()
  const engine: SqlStudioEngine = isSqlStudioEngine(protocol) ? protocol : 'postgres'
  const querySeq = useRef(1)
  const tabsRef = useRef<StudioTab[]>([])
  const treeRef = useRef<DatabaseIntrospection | null>(null)
  const [tabs, setTabs] = useState<StudioTab[]>(() => [emptyQueryTab(1)])
  const [activeId, setActiveId] = useState<string>(() => tabs[0]?.id ?? '')
  const [tree, setTree] = useState<DatabaseIntrospection | null>(null)
  const [loadingTree, setLoadingTree] = useState(false)
  const [runningTabId, setRunningTabId] = useState<string | null>(null)
  const runningTabIdRef = useRef<string | null>(null)
  const loadingMoreRef = useRef(false)
  const [editsByTab, setEditsByTab] = useState<Record<string, GridDraft>>({})
  /** Fallback PK names when introspection missed them — keyed by `schema\\0table`. */
  const [pkOverrideByRelation, setPkOverrideByRelation] = useState<Record<string, string[]>>({})
  const pkLookupInFlight = useRef<Set<string>>(new Set())
  const [txState, setTxState] = useState<DatabaseTxState>({
    autoCommit: true,
    inTransaction: false
  })
  const [txBusy, setTxBusy] = useState(false)
  const sqlEditorRef = useRef<SqlEditorHandle | null>(null)

  tabsRef.current = tabs
  treeRef.current = tree
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null

  const refreshTxState = useCallback(async (): Promise<void> => {
    try {
      const next = await window.north.db.txState({ sessionId })
      setTxState(next)
    } catch {
      // Session may still be connecting; keep last known state.
    }
  }, [sessionId])

  const refreshTree = useCallback(async (): Promise<void> => {
    setLoadingTree(true)
    try {
      const next = await window.north.db.introspect({ sessionId })
      setTree(next)
      setPkOverrideByRelation({})
      pkLookupInFlight.current.clear()
    } catch (err) {
      toastError(err, t('database.studio.introspectError'))
    } finally {
      setLoadingTree(false)
    }
  }, [sessionId, t])

  useEffect(() => {
    void refreshTree()
  }, [refreshTree])

  useEffect(() => {
    void refreshTxState()
  }, [refreshTxState])

  function patchTab(id: string, updater: (tab: StudioTab) => StudioTab): void {
    setTabs((current) => current.map((tab) => (tab.id === id ? updater(tab) : tab)))
  }

  function clearEdits(tabId: string): void {
    setEditsByTab((current) => {
      if (!(tabId in current)) return current
      const { [tabId]: _removed, ...rest } = current
      return rest
    })
  }

  function discardEdits(tabId: string): void {
    setEditsByTab((current) => ({ ...current, [tabId]: emptyGridDraft() }))
  }

  function orderByForTable(schema: string, table: string): string[] | undefined {
    const relation = treeRef.current?.schemas
      .find((node) => node.name === schema)
      ?.tables.find((item) => item.name === table)
    const fromTree = relation ? primaryKeyColumnNames(relation.columns) : []
    const fromOverride = pkOverrideByRelation[`${schema}\0${table}`] ?? []
    const pks = fromTree.length > 0 ? fromTree : fromOverride
    return pks.length > 0 ? pks : undefined
  }

  async function runQuerySql(tabId: string, sqlText: string): Promise<void> {
    const trimmed = sqlText.trim()
    if (!trimmed || runningTabIdRef.current) return
    runningTabIdRef.current = tabId
    setRunningTabId(tabId)
    patchTab(tabId, (tab) => ({ ...tab, error: null }))
    try {
      const next = await window.north.db.query({ sessionId, sql: trimmed })
      clearEdits(tabId)
      patchTab(tabId, (tab) => ({ ...tab, result: next, error: null, pane: 'results' }))
      await refreshTxState()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('database.studio.queryError')
      patchTab(tabId, (tab) => ({ ...tab, error: message, pane: 'messages' }))
      toastError(err, t('database.studio.queryError'))
      await refreshTxState()
    } finally {
      runningTabIdRef.current = null
      setRunningTabId(null)
    }
  }

  async function runTableBrowse(tabId: string, options?: { append?: boolean }): Promise<void> {
    const tab = tabsRef.current.find((item) => item.id === tabId)
    if (!tab || tab.kind !== 'table') return

    const append = options?.append === true
    const filter = tab.filter
    const fullSql = Boolean(filter.trim() && isFullSqlStatement(filter.trim()))
    const currentCount = tab.result?.rows.length ?? 0

    if (append) {
      if (fullSql || !tab.hasMore || tab.browseCapReached || loadingMoreRef.current) return
      if (runningTabIdRef.current) return
      if (currentCount >= TABLE_BROWSE_SOFT_CAP) {
        patchTab(tabId, (current) =>
          current.kind === 'table'
            ? { ...current, hasMore: false, browseCapReached: true }
            : current
        )
        return
      }
      loadingMoreRef.current = true
    } else if (runningTabIdRef.current) {
      return
    }

    const offset = append ? currentCount : 0
    const remaining = TABLE_BROWSE_SOFT_CAP - offset
    const limit = Math.min(TABLE_BROWSE_PAGE_SIZE, Math.max(remaining, 0))
    if (append && limit <= 0) {
      loadingMoreRef.current = false
      patchTab(tabId, (current) =>
        current.kind === 'table' ? { ...current, hasMore: false, browseCapReached: true } : current
      )
      return
    }

    runningTabIdRef.current = tabId
    setRunningTabId(tabId)
    if (!append) {
      patchTab(tabId, (current) => ({ ...current, error: null }))
    }

    const sql = tableBrowsePageSql(
      engine,
      tab.schema,
      tab.table,
      filter,
      offset,
      append ? limit : TABLE_BROWSE_PAGE_SIZE,
      orderByForTable(tab.schema, tab.table)
    )

    try {
      const page = await window.north.db.query({ sessionId, sql })
      if (!append) clearEdits(tabId)
      patchTab(tabId, (current) => {
        if (current.kind !== 'table') return current
        return mergeBrowsePage(current, page, { append, fullSql })
      })
      await refreshTxState()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('database.studio.queryError')
      if (!append) {
        patchTab(tabId, (current) => ({ ...current, error: message, pane: 'messages' }))
      }
      toastError(err, t('database.studio.queryError'))
      await refreshTxState()
    } finally {
      runningTabIdRef.current = null
      setRunningTabId(null)
      loadingMoreRef.current = false
    }
  }

  async function runTab(tabId: string, override?: string): Promise<void> {
    const tab = tabsRef.current.find((item) => item.id === tabId)
    if (!tab) return
    if (tab.kind === 'query') {
      await runQuerySql(tabId, override ?? tab.sql)
      return
    }
    if (override != null) {
      await runQuerySql(tabId, override)
      return
    }
    await runTableBrowse(tabId)
  }

  async function cancel(): Promise<void> {
    try {
      await window.north.db.cancel({ sessionId })
    } catch (err) {
      toastError(err, t('database.studio.cancelError'))
    }
  }

  function openTable(schema: string, table: string): void {
    const resolved = resolveOpenTable(tabsRef.current, schema, table)
    tabsRef.current = resolved.tabs
    setTabs(resolved.tabs)
    setActiveId(resolved.activeId)
    if (resolved.browseTabId) {
      void runTableBrowse(resolved.browseTabId)
    }
  }

  function addQuery(): void {
    querySeq.current += 1
    const next = emptyQueryTab(querySeq.current)
    setTabs((current) => [...current, next])
    setActiveId(next.id)
  }

  function closeStudioTab(id: string): void {
    const nextActive = neighborTabId(tabsRef.current, id, activeId)
    setTabs((current) => current.filter((tab) => tab.id !== id))
    clearEdits(id)
    setActiveId(nextActive ?? '')
  }

  const activeRelation = useMemo((): DatabaseRelation | null => {
    if (!tree || activeTab?.kind !== 'table') return null
    const schema = tree.schemas.find((node) => node.name === activeTab.schema)
    return schema?.tables.find((relation) => relation.name === activeTab.table) ?? null
  }, [tree, activeTab])

  const tableColumnNames = useMemo(
    () => activeRelation?.columns.map((column) => column.name) ?? [],
    [activeRelation]
  )

  const parsedFrom = useMemo(() => {
    if (activeTab?.kind !== 'query') return null
    return parsePrimaryFromRelation(activeTab.sql)
  }, [activeTab])

  const relationPkKey = useMemo(() => {
    if (!activeTab) return null
    if (activeTab.kind === 'table') return `${activeTab.schema}\0${activeTab.table}`
    if (!parsedFrom) return null
    const found = findRelation(tree, parsedFrom.schema, parsedFrom.table)
    const schema = found?.schema ?? parsedFrom.schema ?? tree?.schemas[0]?.name ?? ''
    const table = found?.relation.name ?? parsedFrom.table
    return `${schema}\0${table}`
  }, [activeTab, parsedFrom, tree])

  const updatable = useMemo(() => {
    if (!activeTab) return { ok: false as const, reason: 'not-select' as const }
    const resultNames = activeTab.result?.columns.map((column) => column.name) ?? []
    const pkOverride = relationPkKey ? pkOverrideByRelation[relationPkKey] : undefined
    if (activeTab.kind === 'table') {
      return resolveUpdatableTarget(
        { kind: 'table', schema: activeTab.schema, table: activeTab.table },
        { tree, resultColumnNames: resultNames, pkOverride }
      )
    }
    return resolveUpdatableTarget(
      { kind: 'query', sql: activeTab.sql },
      { tree, resultColumnNames: resultNames, pkOverride }
    )
  }, [activeTab, pkOverrideByRelation, relationPkKey, tree])

  const pkColumns = updatable.ok ? updatable.target.pkColumns : []
  const saveTableColumns = updatable.ok ? updatable.target.tableColumnNames : []

  // Fallback when introspection omitted PKs (common on Postgres before pg_catalog fix).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by relation; override applied via setState
  useEffect(() => {
    if (!activeTab || !relationPkKey) return
    let schema: string
    let table: string
    if (activeTab.kind === 'table') {
      schema = activeTab.schema
      table = activeTab.table
    } else {
      if (!parsedFrom) return
      const found = findRelation(treeRef.current, parsedFrom.schema, parsedFrom.table)
      schema = found?.schema ?? parsedFrom.schema ?? treeRef.current?.schemas[0]?.name ?? ''
      table = found?.relation.name ?? parsedFrom.table
    }
    const relation = findRelation(treeRef.current, schema, table)?.relation
    if (relation && primaryKeyColumnNames(relation.columns).length > 0) return
    if (pkOverrideByRelation[relationPkKey]?.length) return
    if (pkLookupInFlight.current.has(relationPkKey)) return

    const key = relationPkKey
    pkLookupInFlight.current.add(key)
    let cancelled = false

    void (async () => {
      try {
        const sql = primaryKeyLookupSql(engine, schema, table)
        const result = await window.north.db.query({ sessionId, sql })
        const names = result.rows
          .map((row) => {
            const value = row.column_name ?? row.COLUMN_NAME ?? Object.values(row)[0]
            return typeof value === 'string' && value.length > 0 ? value : null
          })
          .filter((name): name is string => Boolean(name))
        if (!cancelled && names.length > 0) {
          setPkOverrideByRelation((current) =>
            current[key] ? current : { ...current, [key]: names }
          )
        }
      } catch {
        // Lookup is best-effort; Save stays disabled with the no-PK tooltip.
      } finally {
        pkLookupInFlight.current.delete(key)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [engine, parsedFrom, relationPkKey, sessionId, activeTab?.kind, activeTab])

  const activeDraft = activeTab ? (editsByTab[activeTab.id] ?? emptyGridDraft()) : emptyGridDraft()
  const dirty = hasDirtyDraft(activeDraft)
  const isTableTab = activeTab?.kind === 'table'
  const isView = activeRelation?.type === 'view' || (!updatable.ok && updatable.reason === 'view')
  const persistableUpdates = activeTab?.result
    ? collectPersistableUpdates(activeDraft, activeTab.result.rows, saveTableColumns)
    : []
  const hasPersistableWork =
    updatable.ok &&
    (persistableUpdates.length > 0 ||
      (isTableTab && (activeDraft.deletes.length > 0 || activeDraft.inserts.length > 0)))
  const editable = true
  const canPersist = updatable.ok
  const canSave = Boolean(canPersist && hasPersistableWork && dirty && runningTabId == null)

  const saveDisabledReason = saveReasonLabel(t, {
    dirty,
    updatableOk: updatable.ok,
    reason: updatable.ok ? null : updatable.reason,
    hasPersistableWork
  })

  async function saveActiveTab(): Promise<void> {
    if (!activeTab || !canSave || !activeTab.result || !updatable.ok) return
    const target = updatable.target
    try {
      const deleteRows =
        activeTab.kind === 'table'
          ? activeDraft.deletes
              .map((index) => activeTab.result?.rows[index])
              .filter((row): row is NonNullable<typeof row> => Boolean(row))
          : []
      const statements = buildMutationStatements({
        engine,
        schema: target.schema,
        table: target.table,
        pkColumns: target.pkColumns,
        deletes: deleteRows,
        updates: persistableUpdates,
        inserts: activeTab.kind === 'table' ? activeDraft.inserts : []
      })
      for (const sql of statements) {
        await window.north.db.query({ sessionId, sql })
      }
      clearEdits(activeTab.id)
      await refreshTxState()
      if (activeTab.kind === 'table') {
        await runTableBrowse(activeTab.id)
      } else {
        await runQuerySql(activeTab.id, activeTab.sql)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('database.studio.saveError')
      patchTab(activeTab.id, (tab) => ({ ...tab, error: message, pane: 'messages' }))
      toastError(err, t('database.studio.saveError'))
      await refreshTxState()
    }
  }

  async function setAutoCommit(on: boolean): Promise<void> {
    if (on === txState.autoCommit) return
    setTxBusy(true)
    try {
      const next = await window.north.db.setAutoCommit({ sessionId, autoCommit: on })
      setTxState(next)
    } catch (err) {
      toastError(err, t('database.studio.autoCommitBlocked'))
      await refreshTxState()
    } finally {
      setTxBusy(false)
    }
  }

  async function commitTx(): Promise<void> {
    setTxBusy(true)
    try {
      const next = await window.north.db.commit({ sessionId })
      setTxState(next)
    } catch (err) {
      toastError(err, t('database.studio.txError'))
      await refreshTxState()
    } finally {
      setTxBusy(false)
    }
  }

  async function rollbackTx(): Promise<void> {
    setTxBusy(true)
    try {
      const next = await window.north.db.rollback({ sessionId })
      setTxState(next)
    } catch (err) {
      toastError(err, t('database.studio.txError'))
      await refreshTxState()
    } finally {
      setTxBusy(false)
    }
  }

  const canSaveRef = useRef(false)
  const saveActiveTabRef = useRef(saveActiveTab)
  canSaveRef.current = canSave
  saveActiveTabRef.current = saveActiveTab

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!visible) return
      if (!(event.metaKey || event.ctrlKey) || event.code !== 'KeyS') return
      if (!canSaveRef.current) return
      event.preventDefault()
      event.stopPropagation()
      void saveActiveTabRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [visible])

  const selectedTable =
    activeTab?.kind === 'table' ? { schema: activeTab.schema, table: activeTab.table } : null
  const canRun =
    activeTab != null &&
    (activeTab.kind === 'table' || activeTab.sql.trim().length > 0) &&
    runningTabId == null

  const folderLabel = environmentName?.trim() || title || t('database.studio.title')
  const tableHasMore = activeTab?.kind === 'table' ? activeTab.hasMore : false
  const tableCapReached = activeTab?.kind === 'table' ? activeTab.browseCapReached : false
  const txActionHint = txState.autoCommit
    ? t('database.studio.txDisabledAutoCommit')
    : txState.inTransaction
      ? undefined
      : t('database.studio.txDisabledIdle')

  function loadMoreActiveTable(): void {
    if (activeTab?.kind !== 'table') return
    void runTableBrowse(activeTab.id, { append: true })
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      style={{ display: visible ? 'flex' : 'none' }}
      data-testid="database-studio"
    >
      <SessionIdentityBar
        username={username}
        host={host}
        folderLabel={folderLabel}
        environmentName={environmentName}
        environmentColor={environmentColor}
      >
        {txState.inTransaction ? (
          <span
            className="mr-1 truncate text-[11px] text-muted"
            data-testid="database-tx-open"
            title={t('database.studio.inTransaction')}
          >
            {t('database.studio.inTransaction')}
          </span>
        ) : null}
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Switch
            checked={txState.autoCommit}
            disabled={txBusy || (txState.inTransaction && !txState.autoCommit)}
            onCheckedChange={(checked) => void setAutoCommit(checked)}
            aria-label={t('database.studio.autoCommit')}
            data-testid="database-auto-commit"
          />
          <span className="whitespace-nowrap">{t('database.studio.autoCommit')}</span>
        </div>
        <TxActionButton
          testId="database-commit"
          label={t('database.studio.commit')}
          hint={txActionHint}
          disabled={txBusy || txState.autoCommit || !txState.inTransaction}
          onClick={() => void commitTx()}
        >
          <Check className="size-3.5" />
          {t('database.studio.commit')}
        </TxActionButton>
        <TxActionButton
          testId="database-rollback"
          label={t('database.studio.rollback')}
          hint={txActionHint}
          disabled={txBusy || txState.autoCommit || !txState.inTransaction}
          onClick={() => void rollbackTx()}
        >
          <Undo2 className="size-3.5" />
          {t('database.studio.rollback')}
        </TxActionButton>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={loadingTree}
          onClick={() => void refreshTree()}
        >
          <RefreshCw className={cn('size-3.5', loadingTree ? 'animate-spin' : '')} />
          {t('database.studio.schema')}
        </Button>
      </SessionIdentityBar>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel id="schema" defaultSize="22%" minSize="14%" className="min-w-0">
          <SchemaTree
            tree={tree}
            loading={loadingTree}
            selected={selectedTable}
            onOpenTable={openTable}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="work" defaultSize="78%" minSize="40%" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col">
            <StudioTabBar
              tabs={tabs}
              activeId={activeTab?.id ?? null}
              running={runningTabId === activeTab?.id}
              canRun={canRun}
              canFormat={activeTab?.kind === 'query' && activeTab.sql.trim().length > 0}
              onActivate={setActiveId}
              onClose={closeStudioTab}
              onNewQuery={addQuery}
              onRun={() => {
                if (activeTab) void runTab(activeTab.id)
              }}
              onCancel={() => void cancel()}
              onFormat={
                activeTab?.kind === 'query' ? () => sqlEditorRef.current?.format() : undefined
              }
            />
            {activeTab ? (
              activeTab.kind === 'table' ? (
                <TableDataPane
                  key={activeTab.id}
                  filter={activeTab.filter}
                  engine={engine}
                  columns={tableColumnNames}
                  running={runningTabId === activeTab.id}
                  result={activeTab.result}
                  error={activeTab.error}
                  pane={activeTab.pane}
                  editable={editable}
                  canPersist={canPersist}
                  draft={activeDraft}
                  pkColumns={pkColumns}
                  canSave={canSave}
                  saveDisabledReason={saveDisabledReason}
                  browseHasMore={tableHasMore}
                  browseCapReached={tableCapReached}
                  onFilterChange={(filter) =>
                    patchTab(activeTab.id, (current) =>
                      current.kind === 'table' ? { ...current, filter } : current
                    )
                  }
                  onRun={() => void runTab(activeTab.id)}
                  onLoadMore={loadMoreActiveTable}
                  onPaneChange={(pane) =>
                    patchTab(activeTab.id, (current) => ({ ...current, pane }))
                  }
                  onDraftChange={(draft) =>
                    setEditsByTab((current) => ({ ...current, [activeTab.id]: draft }))
                  }
                  onSave={() => void saveActiveTab()}
                  onDiscard={() => discardEdits(activeTab.id)}
                  rowActions={!isView}
                />
              ) : (
                <QueryTabPane
                  key={activeTab.id}
                  tab={activeTab}
                  engine={engine}
                  tree={tree}
                  visible={visible}
                  running={runningTabId === activeTab.id}
                  editorRef={sqlEditorRef}
                  editable={editable}
                  canPersist={canPersist}
                  draft={activeDraft}
                  pkColumns={pkColumns}
                  canSave={canSave}
                  saveDisabledReason={saveDisabledReason}
                  onDraftChange={(draft) =>
                    setEditsByTab((current) => ({ ...current, [activeTab.id]: draft }))
                  }
                  onSave={() => void saveActiveTab()}
                  onDiscard={() => discardEdits(activeTab.id)}
                  onSqlChange={(sql) =>
                    patchTab(activeTab.id, (current) =>
                      current.kind === 'query' ? { ...current, sql } : current
                    )
                  }
                  onRun={(sql) => void runTab(activeTab.id, sql)}
                  onPaneChange={(pane) =>
                    patchTab(activeTab.id, (current) => ({ ...current, pane }))
                  }
                />
              )
            ) : (
              <p className="px-3 py-4 text-xs text-muted">{t('database.studio.emptyTabs')}</p>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function mergeBrowsePage(
  tab: TableStudioTab,
  page: DatabaseQueryResult,
  options: { append: boolean; fullSql: boolean }
): TableStudioTab {
  const { append, fullSql } = options
  if (!append || !tab.result) {
    const hasMore = !fullSql && page.rows.length >= TABLE_BROWSE_PAGE_SIZE
    const capped = page.rows.length >= TABLE_BROWSE_SOFT_CAP
    return {
      ...tab,
      result: {
        ...page,
        rows: capped ? page.rows.slice(0, TABLE_BROWSE_SOFT_CAP) : page.rows,
        rowCount: capped ? Math.min(page.rows.length, TABLE_BROWSE_SOFT_CAP) : page.rows.length
      },
      error: null,
      pane: 'results',
      hasMore: hasMore && !capped,
      browseCapReached: capped
    }
  }

  const mergedRows = [...tab.result.rows, ...page.rows]
  const capped = mergedRows.length >= TABLE_BROWSE_SOFT_CAP
  const rows = capped ? mergedRows.slice(0, TABLE_BROWSE_SOFT_CAP) : mergedRows
  const hasMore = !fullSql && !capped && page.rows.length >= TABLE_BROWSE_PAGE_SIZE

  return {
    ...tab,
    result: {
      ...tab.result,
      columns: tab.result.columns.length > 0 ? tab.result.columns : page.columns,
      rows,
      rowCount: rows.length,
      durationMs: page.durationMs,
      truncated: false,
      affectedRows: null
    },
    error: null,
    pane: 'results',
    hasMore,
    browseCapReached: capped
  }
}

function QueryTabPane({
  tab,
  engine,
  tree,
  visible,
  running,
  editorRef,
  editable,
  canPersist,
  draft,
  pkColumns,
  canSave,
  saveDisabledReason,
  onDraftChange,
  onSave,
  onDiscard,
  onSqlChange,
  onRun,
  onPaneChange
}: {
  tab: QueryStudioTab
  engine: SqlStudioEngine
  tree: DatabaseIntrospection | null
  visible: boolean
  running: boolean
  editorRef: React.RefObject<SqlEditorHandle | null>
  editable: boolean
  canPersist: boolean
  draft: GridDraft
  pkColumns: readonly string[]
  canSave: boolean
  saveDisabledReason: string | null
  onDraftChange: (draft: GridDraft) => void
  onSave: () => void
  onDiscard: () => void
  onSqlChange: (sql: string) => void
  onRun: (sql: string) => void
  onPaneChange: (pane: StudioPane) => void
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full min-h-0 flex-1">
      <ResizablePanel id={`editor-${tab.id}`} defaultSize="42%" minSize="20%" className="min-h-0">
        <SqlEditor
          value={tab.sql}
          engine={engine}
          tree={tree}
          onChange={onSqlChange}
          onRun={onRun}
          visible={visible}
          editorRef={editorRef}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id={`results-${tab.id}`} defaultSize="58%" minSize="20%" className="min-h-0">
        <QueryResultPane
          result={tab.result}
          error={tab.error}
          pane={tab.pane}
          running={running}
          emptyHint={t('database.studio.runHint')}
          onPaneChange={onPaneChange}
          editable={editable}
          canPersist={canPersist}
          draft={draft}
          onDraftChange={onDraftChange}
          pkColumns={pkColumns}
          canSave={canSave}
          saveDisabledReason={saveDisabledReason}
          onSave={onSave}
          onDiscard={onDiscard}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function collectPersistableUpdates(
  draft: GridDraft,
  rows: DatabaseQueryResult['rows'],
  tableColumnNames: readonly string[]
): Array<{
  original: DatabaseQueryResult['rows'][number]
  changes: DatabaseQueryResult['rows'][number]
}> {
  return collectUpdatePayloads(draft.edits, rows, draft.deletes)
    .map((payload) => ({
      original: payload.original,
      changes: filterChangesToTableColumns(payload.changes, tableColumnNames)
    }))
    .filter((payload) => Object.keys(payload.changes).length > 0)
}

function saveReasonLabel(
  t: (key: string) => string,
  options: {
    dirty: boolean
    updatableOk: boolean
    reason: UpdatableQueryReason | null
    hasPersistableWork: boolean
  }
): string | null {
  if (!options.updatableOk && options.reason) {
    switch (options.reason) {
      case 'view':
        return t('database.studio.saveDisabledView')
      case 'no-pk':
      case 'pk-not-in-result':
        return t('database.studio.saveNoPk')
      case 'cte':
      case 'distinct':
      case 'group-by':
      case 'set-op':
        return t('database.studio.saveDisabledAggregated')
      default:
        return t('database.studio.saveDisabledNoTarget')
    }
  }
  if (!options.dirty) return t('database.studio.saveDisabledClean')
  if (!options.hasPersistableWork) return t('database.studio.saveDisabledNoTarget')
  return null
}

function TxActionButton({
  testId,
  label,
  hint,
  disabled,
  onClick,
  children
}: {
  testId: string
  label: string
  hint?: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1 px-2 text-xs"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
    >
      {children}
    </Button>
  )

  if (!hint) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}
