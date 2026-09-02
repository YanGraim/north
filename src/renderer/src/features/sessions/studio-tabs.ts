import type { DatabaseQueryResult } from '@shared/protocols'

export type StudioPane = 'results' | 'messages'

type StudioTabCommon = {
  id: string
  result: DatabaseQueryResult | null
  error: string | null
  pane: StudioPane
  /** Fetched total when browse uses pagination (DBeaver-style count). */
  totalRowCount: number | null
}

export type TableStudioTab = StudioTabCommon & {
  kind: 'table'
  schema: string
  table: string
  filter: string
  /** True when another browse page may still exist on the server. */
  hasMore: boolean
  /** Soft cap reached in the renderer (stop appending). */
  browseCapReached: boolean
}

export type QueryStudioTab = StudioTabCommon & {
  kind: 'query'
  queryNumber: number
  sql: string
  /** Snapshot of the statement that produced `result` (never the paginated SQL). */
  executedSql: string | null
  hasMore: boolean
  browseCapReached: boolean
}

export type StudioTab = TableStudioTab | QueryStudioTab

export function emptyQueryTab(queryNumber: number): QueryStudioTab {
  return {
    id: crypto.randomUUID(),
    kind: 'query',
    queryNumber,
    sql: '',
    result: null,
    error: null,
    pane: 'results',
    executedSql: null,
    hasMore: false,
    browseCapReached: false,
    totalRowCount: null
  }
}

export function emptyTableTab(schema: string, table: string): TableStudioTab {
  return {
    id: crypto.randomUUID(),
    kind: 'table',
    schema,
    table,
    filter: '',
    result: null,
    error: null,
    pane: 'results',
    hasMore: false,
    browseCapReached: false,
    totalRowCount: null
  }
}

export function neighborTabId(
  tabs: StudioTab[],
  closedId: string,
  activeId: string | null
): string | null {
  if (activeId !== closedId) return activeId
  const index = tabs.findIndex((tab) => tab.id === closedId)
  const next = tabs[index + 1] ?? tabs[index - 1]
  return next?.id ?? null
}

/**
 * Opens or focuses a table tab. Caller must sync `tabsRef` with `tabs` before
 * running browse — React state alone is not updated yet when browse looks up the tab.
 */
export function resolveOpenTable(
  tabs: readonly StudioTab[],
  schema: string,
  table: string
): { tabs: StudioTab[]; activeId: string; browseTabId: string | null } {
  const existing = tabs.find(
    (tab) => tab.kind === 'table' && tab.schema === schema && tab.table === table
  )
  if (existing) {
    return {
      tabs: [...tabs],
      activeId: existing.id,
      browseTabId: existing.result == null ? existing.id : null
    }
  }
  const next = emptyTableTab(schema, table)
  return {
    tabs: [...tabs, next],
    activeId: next.id,
    browseTabId: next.id
  }
}
