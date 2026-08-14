import {
  type Completion,
  type CompletionSource,
  insertCompletionText,
  pickedCompletion
} from '@codemirror/autocomplete'
import {
  keywordCompletionSource,
  MSSQL,
  MySQL,
  PostgreSQL,
  type SQLConfig,
  type SQLDialect,
  SQLite,
  type SQLNamespace,
  schemaCompletionSource
} from '@codemirror/lang-sql'
import type { EditorView } from '@codemirror/view'
import { quoteIdent } from '@shared/lib/sql-ident'
import type {
  DatabaseIntrospection,
  DatabaseRelationKind,
  SqlStudioEngine
} from '@shared/protocols'

const SQL_KEYWORDS_AFTER_TABLE =
  /^(where|join|inner|left|right|full|outer|cross|on|group|order|limit|offset|having|union|except|intersect|returning|into|set|values|and|or|as|,|;|\)|\()/i

export function dialectForEngine(engine: SqlStudioEngine): SQLDialect {
  switch (engine) {
    case 'mysql':
    case 'mariadb':
      return MySQL
    case 'mssql':
      return MSSQL
    case 'sqlite':
      return SQLite
    default:
      return PostgreSQL
  }
}

/** Quote only when the identifier is unsafe as a bare SQL name. */
export function formatIdent(engine: SqlStudioEngine, ident: string): string {
  // Postgres/SQLite fold unquoted names to lowercase — preserve mixed/upper case.
  if (engine === 'postgres' || engine === 'sqlite') {
    if (/^[a-z_][a-z0-9_]*$/.test(ident)) return ident
    return quoteIdent(engine, ident)
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) return ident
  return quoteIdent(engine, ident)
}

function columnCompletion(engine: SqlStudioEngine, columnName: string): Completion {
  return {
    label: columnName,
    type: 'property',
    detail: 'column',
    apply: formatIdent(engine, columnName)
  }
}

/** snake/kebab segments → initials (`balances` → `b`, `api_version` → `av`). */
export function aliasBase(tableName: string): string {
  const parts = tableName.split(/[_-]+/).filter(Boolean)
  const initials = parts
    .map((part) => part[0] ?? '')
    .join('')
    .toLowerCase()
  return initials || 't'
}

export function collectWordSet(sqlText: string): Set<string> {
  const words = sqlText.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
  return new Set(words.map((word) => word.toLowerCase()))
}

export function uniqueAlias(tableName: string, sqlText: string): string {
  const used = collectWordSet(sqlText)
  const base = aliasBase(tableName)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}${n}`)) n += 1
  return `${base}${n}`
}

/**
 * Rank a schema object against the typed query (DBeaver-style).
 * Prefix and substring beat token/fuzzy; unmatched names return null.
 */
export function scoreObjectMatch(name: string, query: string): number | null {
  const n = name.toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q) return 1
  if (n === q) return 100
  if (n.startsWith(q)) return 80
  const idx = n.indexOf(q)
  if (idx >= 0) {
    const boundary = idx === 0 || n[idx - 1] === '_' || n[idx - 1] === '-'
    return boundary ? 60 : 45
  }
  const parts = n.split(/[_-]+/).filter(Boolean)
  if (parts.some((part) => part.startsWith(q))) return 55
  if (q.length >= 3 && parts.some((part) => part.length >= 3 && q.startsWith(part))) return 30
  return null
}

export function matchRanges(label: string, query: string): number[] {
  const n = label.toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q) return []
  const idx = n.indexOf(q)
  if (idx >= 0) return [idx, idx + q.length]
  return []
}

export type StudioCompletion = Completion & { aliasPreview?: string }

export function listTableNames(tree: DatabaseIntrospection | null | undefined): string[] {
  if (!tree) return []
  const names: string[] = []
  for (const schema of tree.schemas) {
    for (const table of schema.tables) {
      names.push(table.name)
    }
  }
  return names
}

function tableCompletion(
  engine: SqlStudioEngine,
  tableName: string,
  kind: DatabaseRelationKind
): StudioCompletion {
  const label = formatIdent(engine, tableName)
  return {
    label: tableName,
    type: 'type',
    detail: kind === 'view' ? 'View' : 'Table',
    boost: 16,
    aliasPreview: aliasBase(tableName),
    apply: (view, completion, from, to) => {
      const doc = view.state.doc.toString()
      const alias = uniqueAlias(tableName, `${doc.slice(0, from)}${doc.slice(to)}`)
      const text = `${label} ${alias}`
      view.dispatch({
        ...insertCompletionText(view.state, text, from, to),
        annotations: pickedCompletion.of(completion)
      })
    }
  }
}

export function buildSqlSchema(
  engine: SqlStudioEngine,
  tree: DatabaseIntrospection | null | undefined
): SQLNamespace {
  const root: Record<string, SQLNamespace> = Object.create(null)
  if (!tree) return root

  for (const schema of tree.schemas) {
    const schemaNode: Record<string, SQLNamespace> = Object.create(null)
    for (const table of schema.tables) {
      schemaNode[table.name] = {
        self: tableCompletion(engine, table.name, table.type),
        children: table.columns.map((column) => column.name)
      }
    }
    root[schema.name] = schemaNode
  }
  return root
}

export function buildSqlConfig(
  engine: SqlStudioEngine,
  tree: DatabaseIntrospection | null | undefined
): SQLConfig {
  const schemas = tree?.schemas ?? []
  const defaultSchema =
    schemas.find((schema) => schema.name === 'public' || schema.name === 'main')?.name ??
    schemas[0]?.name

  return {
    dialect: dialectForEngine(engine),
    schema: buildSqlSchema(engine, tree),
    defaultSchema,
    upperCaseKeywords: true
  }
}

export function aliasCompletionRenderer(completion: Completion): Node | null {
  const alias = (completion as StudioCompletion).aliasPreview
  if (!alias) return null
  const span = document.createElement('span')
  span.className = 'cm-completionAlias'
  span.textContent = alias
  return span
}

export function completionOptionClass(completion: Completion): string {
  if (completion.detail === 'Table' || completion.detail === 'View')
    return 'cm-completion-kind-table'
  if (completion.type === 'keyword' || completion.detail === 'Keyword') {
    return 'cm-completion-kind-keyword'
  }
  if (completion.detail === 'column') return 'cm-completion-kind-column'
  return ''
}

const RELATION_INTRO = new Set(['from', 'join', 'into', 'update', 'table'])
const RELATION_STOP = new Set([
  'select',
  'where',
  'group',
  'order',
  'having',
  'limit',
  'offset',
  'set',
  'values',
  'on',
  'using',
  'returning',
  'union',
  'except',
  'intersect'
])

/** True when the cursor is completing a table/view (after FROM / JOIN / INTO / UPDATE). */
export function isRelationCompletionContext(doc: string, pos: number): boolean {
  const before = doc.slice(0, Math.max(0, pos))
  const endsWithSpace = /\s$/.test(before)
  const tokens = before.split(/[\s,()]+/).filter(Boolean)
  const stack = endsWithSpace ? tokens : tokens.slice(0, -1)
  for (let i = stack.length - 1; i >= 0; i--) {
    const token = stack[i]?.toLowerCase() ?? ''
    if (RELATION_INTRO.has(token)) return true
    if (RELATION_STOP.has(token)) return false
  }
  return false
}

/** Schema objects with CodeMirror fuzzy match; keywords only by prefix (avoids dialect noise). */
export function studioCompletionSources(config: SQLConfig): CompletionSource[] {
  const dialect: SQLDialect = config.dialect ?? PostgreSQL
  const keywords = keywordCompletionSource(dialect, true, (label, type) => ({
    label,
    type,
    detail: 'Keyword',
    boost: -30
  }))
  return [
    boostMatchedTables(schemaCompletionSource(config)),
    hideKeywordsInRelationContext(keywords)
  ]
}

function hideKeywordsInRelationContext(source: CompletionSource): CompletionSource {
  return (context) => {
    if (isRelationCompletionContext(context.state.doc.toString(), context.pos)) return null
    return prefixOnly(source)(context)
  }
}

function boostMatchedTables(source: CompletionSource): CompletionSource {
  return (context) => {
    const result = source(context)
    if (!result) return null
    if (result instanceof Promise) {
      return result.then((resolved) => applyTableBoost(resolved, context))
    }
    return applyTableBoost(result, context)
  }
}

function applyTableBoost(
  result: { from: number; to?: number; options: readonly Completion[] } | null,
  context: { state: { sliceDoc: (from: number, to: number) => string }; pos: number }
): { from: number; to?: number; options: Completion[] } | null {
  if (!result) return null
  const query = context.state.sliceDoc(result.from, result.to ?? context.pos)
  const options = result.options.map((option) => {
    if (option.detail !== 'Table' && option.detail !== 'View') return option
    const extra = scoreObjectMatch(option.label, query)
    if (extra == null) return option
    return { ...option, boost: (option.boost ?? 0) + extra }
  })
  return { from: result.from, to: result.to, options }
}

function prefixOnly(source: CompletionSource): CompletionSource {
  return (context) => {
    const result = source(context)
    if (!result) return null
    if (result instanceof Promise) {
      return result.then((resolved) => filterPrefixResult(resolved, context))
    }
    return filterPrefixResult(result, context)
  }
}

function filterPrefixResult(
  result: { from: number; to?: number; options: readonly Completion[] } | null,
  context: { state: { sliceDoc: (from: number, to: number) => string }; pos: number }
): { from: number; to?: number; options: Completion[] } | null {
  if (!result) return null
  const query = context.state.sliceDoc(result.from, result.to ?? context.pos).toLowerCase()
  if (!query) return { from: result.from, to: result.to, options: [...result.options] }
  return {
    from: result.from,
    to: result.to,
    options: result.options.filter((option) => option.label.toLowerCase().startsWith(query))
  }
}

/** Keywords useful in a table WHERE / filter bar (DBeaver-style, not the full dialect). */
export const FILTER_KEYWORDS = [
  'AND',
  'OR',
  'NOT',
  'NULL',
  'TRUE',
  'FALSE',
  'LIKE',
  'ILIKE',
  'IN',
  'IS',
  'BETWEEN',
  'EXISTS'
] as const

function matchesFilterQuery(label: string, prefix: string): boolean {
  return scoreObjectMatch(label, prefix) != null
}

/** Pure list of filter-bar completions for a typed prefix (columns first, then keywords). */
export function listFilterCompletions(
  engine: SqlStudioEngine,
  columns: readonly string[],
  prefix: string
): Completion[] {
  const columnOptions: Completion[] = columns
    .filter((name) => matchesFilterQuery(name, prefix))
    .map((name) => ({
      ...columnCompletion(engine, name),
      boost: 2 + (scoreObjectMatch(name, prefix) ?? 0)
    }))
    .sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0) || a.label.localeCompare(b.label))

  const keywordOptions: Completion[] = FILTER_KEYWORDS.filter(
    (word) => !prefix || word.toLowerCase().startsWith(prefix.toLowerCase())
  ).map((word) => ({
    label: word,
    type: 'keyword',
    detail: 'keyword',
    apply: word,
    boost: 1
  }))

  return [...columnOptions, ...keywordOptions]
}

/**
 * CodeMirror completion source for the table filter bar.
 * Only current-table columns + a small WHERE-keyword set — no other tables / dialect noise.
 */
export function createFilterCompletionSource(
  getEngine: () => SqlStudioEngine,
  getColumns: () => readonly string[]
): (context: {
  pos: number
  explicit: boolean
  matchBefore: (regex: RegExp) => { from: number; to: number; text: string } | null
}) => { from: number; options: Completion[]; filter: boolean } | null {
  return (context) => {
    const quoted = context.matchBefore(/"[A-Za-z0-9_]*"?/)
    const bare = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/)
    const token = quoted ?? bare
    if (!token) {
      if (!context.explicit) return null
      return {
        from: context.pos,
        options: listFilterCompletions(getEngine(), getColumns(), ''),
        filter: false
      }
    }
    if (token.from === token.to && !context.explicit) return null
    const raw = token.text
    const prefix = raw.startsWith('"') ? raw.replaceAll('"', '') : raw
    return {
      from: token.from,
      options: listFilterCompletions(getEngine(), getColumns(), prefix),
      filter: false
    }
  }
}

export type IdentAtCursor = {
  from: number
  to: number
  text: string
}

export function identAt(doc: string, pos: number): IdentAtCursor | null {
  if (pos < 0 || pos > doc.length) return null
  let from = pos
  let to = pos
  while (from > 0 && /[A-Za-z0-9_]/.test(doc[from - 1] ?? '')) from -= 1
  while (to < doc.length && /[A-Za-z0-9_]/.test(doc[to] ?? '')) to += 1
  if (from === to) return null
  const text = doc.slice(from, to)
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) return null
  return { from, to, text }
}

/** True when the table at `to` is not already followed by an alias. */
export function tableNeedsAlias(doc: string, tableEnd: number): boolean {
  const rest = doc.slice(tableEnd)
  const match = /^\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(rest)
  if (!match) return true
  return SQL_KEYWORDS_AFTER_TABLE.test(match[1] ?? '')
}

export function planTableAliasExpand(
  doc: string,
  cursor: number,
  engine: SqlStudioEngine,
  tableNames: ReadonlySet<string>
): { from: number; to: number; insert: string } | null {
  const ident = identAt(doc, cursor)
  if (!ident) return null
  if (!tableNames.has(ident.text)) return null
  if (!tableNeedsAlias(doc, ident.to)) return null

  const withoutIdent = `${doc.slice(0, ident.from)}${doc.slice(ident.to)}`
  const alias = uniqueAlias(ident.text, withoutIdent)
  const formatted = formatIdent(engine, ident.text)
  return { from: ident.from, to: ident.to, insert: `${formatted} ${alias}` }
}

export function expandTableAliasAtCursor(
  view: EditorView,
  engine: SqlStudioEngine,
  tableNames: ReadonlySet<string>
): boolean {
  const plan = planTableAliasExpand(
    view.state.doc.toString(),
    view.state.selection.main.head,
    engine,
    tableNames
  )
  if (!plan) return false
  view.dispatch({
    changes: { from: plan.from, to: plan.to, insert: plan.insert },
    selection: { anchor: plan.from + plan.insert.length }
  })
  return true
}
