import type {
  DatabaseCellValue,
  DatabaseIntrospection,
  DatabaseRelation
} from '../protocols/database'
import { alignPrimaryKeyNames, primaryKeyColumnNames } from './sql-update'

export type PrimaryFromRelation = {
  schema: string | null
  table: string
}

export type UpdatableQueryReason =
  | 'not-select'
  | 'cte'
  | 'distinct'
  | 'group-by'
  | 'set-op'
  | 'no-from'
  | 'subquery-from'
  | 'no-pk'
  | 'pk-not-in-result'
  | 'view'

export type UpdatableTarget = {
  schema: string
  table: string
  pkColumns: string[]
  tableColumnNames: string[]
}

export type InferUpdatableResult =
  | { ok: true; target: UpdatableTarget }
  | { ok: false; reason: UpdatableQueryReason }

export type SqlUpdatableAnalysis =
  | { kind: 'ok'; schema: string | null; table: string }
  | {
      kind: 'blocked'
      reason: Exclude<UpdatableQueryReason, 'no-pk' | 'pk-not-in-result' | 'view'>
    }

type IdentRead = {
  value: string
  next: number
  quoted: boolean
}

function skipTrivia(sql: string, index: number): number {
  const length = sql.length
  let i = index
  while (i < length) {
    const ch = sql[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i += 1
      continue
    }
    if (ch === '-' && sql[i + 1] === '-') {
      i += 2
      while (i < length && sql[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      i += 2
      while (i < length && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1
      i = Math.min(i + 2, length)
      continue
    }
    break
  }
  return i
}

function skipQuoted(sql: string, index: number, quote: string, closer: string): number {
  let i = index + 1
  while (i < sql.length) {
    if (quote !== '[' && sql[i] === '\\') {
      i += 2
      continue
    }
    if (sql[i] === closer) {
      if (quote !== '[' && sql[i + 1] === closer) {
        i += 2
        continue
      }
      return i + 1
    }
    i += 1
  }
  return i
}

function skipString(sql: string, index: number): number {
  const ch = sql[index]
  if (ch === "'" || ch === '"') return skipQuoted(sql, index, ch, ch)
  if (ch === 'N' && sql[index + 1] === "'") return skipQuoted(sql, index + 1, "'", "'")
  return index + 1
}

function readIdent(sql: string, index: number): IdentRead | null {
  const i = skipTrivia(sql, index)
  const ch = sql[i]
  if (!ch) return null
  if (ch === '"' || ch === '`') {
    const start = i + 1
    const end = skipQuoted(sql, i, ch, ch) - 1
    return { value: unescapeIdent(sql.slice(start, end), ch), next: end + 1, quoted: true }
  }
  if (ch === '[') {
    const start = i + 1
    const end = skipQuoted(sql, i, '[', ']') - 1
    return { value: sql.slice(start, end).replaceAll(']]', ']'), next: end + 1, quoted: true }
  }
  if (/[A-Za-z_@]/.test(ch)) {
    let j = i + 1
    while (j < sql.length && /[A-Za-z0-9_$@]/.test(sql[j] ?? '')) j += 1
    return { value: sql.slice(i, j), next: j, quoted: false }
  }
  return null
}

function unescapeIdent(value: string, quote: string): string {
  return value.replaceAll(`${quote}${quote}`, quote)
}

function keywordAt(sql: string, index: number): { keyword: string; next: number } | null {
  const ident = readIdent(sql, index)
  if (!ident || ident.quoted) return null
  return { keyword: ident.value.toLowerCase(), next: ident.next }
}

function isKeyword(sql: string, index: number, expected: string): number | null {
  const found = keywordAt(sql, index)
  if (!found || found.keyword !== expected) return null
  return found.next
}

/**
 * First relation of the top-level FROM (`balances b`, `schema.tabela`, with or without JOIN).
 * Returns null when there is no FROM table (subquery, missing FROM, not a SELECT).
 */
export function parsePrimaryFromRelation(sql: string): PrimaryFromRelation | null {
  const analysis = analyzeUpdatableSql(sql)
  if (analysis.kind !== 'ok') return null
  return { schema: analysis.schema, table: analysis.table }
}

export function analyzeUpdatableSql(sql: string): SqlUpdatableAnalysis {
  const text = sql.trim().replace(/^\uFEFF/, '')
  if (!text) return { kind: 'blocked', reason: 'not-select' }

  let i = skipTrivia(text, 0)
  const first = keywordAt(text, i)
  if (!first) return { kind: 'blocked', reason: 'not-select' }
  if (first.keyword === 'with') return { kind: 'blocked', reason: 'cte' }
  if (first.keyword !== 'select') return { kind: 'blocked', reason: 'not-select' }

  let depth = 0
  let afterSelect = true
  let sawFrom = false
  let fromPos: number | null = null
  let hasDistinct = false
  let hasGroupBy = false
  let hasSetOp = false
  i = first.next

  while (i < text.length) {
    i = skipTrivia(text, i)
    if (i >= text.length) break
    const ch = text[i]
    if (ch === "'" || ch === '"') {
      i = skipString(text, i)
      continue
    }
    if (ch === 'N' && text[i + 1] === "'") {
      i = skipString(text, i)
      continue
    }
    if (ch === '`' || ch === '[') {
      const ident = readIdent(text, i)
      i = ident?.next ?? i + 1
      continue
    }
    if (ch === '(') {
      depth += 1
      afterSelect = false
      i += 1
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      i += 1
      continue
    }
    if (ch === ',' || ch === ';' || ch === '.') {
      i += 1
      continue
    }

    const word = keywordAt(text, i)
    if (!word) {
      i += 1
      continue
    }

    if (depth === 0) {
      if (afterSelect && !sawFrom && word.keyword === 'distinct') hasDistinct = true
      if (word.keyword === 'from' && fromPos === null) {
        sawFrom = true
        afterSelect = false
        fromPos = word.next
      }
      if (word.keyword === 'group') {
        const by = isKeyword(text, word.next, 'by')
        if (by !== null) hasGroupBy = true
      }
      if (word.keyword === 'union' || word.keyword === 'except' || word.keyword === 'intersect') {
        hasSetOp = true
      }
    }

    if (word.keyword !== 'select') afterSelect = false
    i = word.next
  }

  if (hasDistinct) return { kind: 'blocked', reason: 'distinct' }
  if (hasGroupBy) return { kind: 'blocked', reason: 'group-by' }
  if (hasSetOp) return { kind: 'blocked', reason: 'set-op' }
  if (fromPos === null) return { kind: 'blocked', reason: 'no-from' }

  const relation = readFromRelation(text, fromPos)
  if (!relation) return { kind: 'blocked', reason: 'subquery-from' }
  return { kind: 'ok', schema: relation.schema, table: relation.table }
}

function readFromRelation(sql: string, fromPos: number): PrimaryFromRelation | null {
  let i = skipTrivia(sql, fromPos)
  if (sql[i] === '(') return null

  const parts: string[] = []
  const first = readIdent(sql, i)
  if (!first) return null
  parts.push(first.value)
  i = first.next

  while (true) {
    i = skipTrivia(sql, i)
    if (sql[i] !== '.') break
    const next = readIdent(sql, i + 1)
    if (!next) break
    parts.push(next.value)
    i = next.next
  }

  const table = parts[parts.length - 1]
  if (!table) return null
  const schema = parts.length >= 2 ? (parts[parts.length - 2] ?? null) : null
  return { schema, table }
}

export function findRelation(
  tree: DatabaseIntrospection | null,
  schema: string | null,
  table: string
): { schema: string; relation: DatabaseRelation } | null {
  if (!tree) return null
  const tableLower = table.toLowerCase()

  function matchTable(node: { name: string; tables: DatabaseRelation[] }): DatabaseRelation | null {
    return (
      node.tables.find((item) => item.name === table) ??
      node.tables.find((item) => item.name.toLowerCase() === tableLower) ??
      null
    )
  }

  if (schema) {
    const schemaLower = schema.toLowerCase()
    const node =
      tree.schemas.find((item) => item.name === schema) ??
      tree.schemas.find((item) => item.name.toLowerCase() === schemaLower)
    if (node) {
      const relation = matchTable(node)
      if (relation) return { schema: node.name, relation }
    }
  }

  for (const node of tree.schemas) {
    const relation = matchTable(node)
    if (relation) return { schema: node.name, relation }
  }
  return null
}

function resultHasColumn(resultColumnNames: readonly string[], column: string): boolean {
  return resultColumnNames.some(
    (name) => name === column || name.toLowerCase() === column.toLowerCase()
  )
}

function resolvePkColumns(
  relation: DatabaseRelation | null,
  resultColumnNames: readonly string[],
  pkOverride: readonly string[] | undefined
): { pkColumns: string[]; reason: 'no-pk' | 'pk-not-in-result' | null } {
  const fromTree = relation ? primaryKeyColumnNames(relation.columns) : []
  const names = fromTree.length > 0 ? fromTree : [...(pkOverride ?? [])]
  if (names.length === 0) return { pkColumns: [], reason: 'no-pk' }
  const aligned = alignPrimaryKeyNames(names, resultColumnNames)
  if (aligned.some((column) => !resultHasColumn(resultColumnNames, column))) {
    return { pkColumns: aligned, reason: 'pk-not-in-result' }
  }
  return { pkColumns: aligned, reason: null }
}

export function resolveUpdatableTarget(
  source: { kind: 'table'; schema: string; table: string } | { kind: 'query'; sql: string },
  options: {
    tree: DatabaseIntrospection | null
    resultColumnNames: readonly string[]
    pkOverride?: readonly string[]
  }
): InferUpdatableResult {
  const { tree, resultColumnNames, pkOverride } = options
  let schema: string
  let table: string
  let found: { schema: string; relation: DatabaseRelation } | null

  if (source.kind === 'table') {
    schema = source.schema
    table = source.table
    found = findRelation(tree, schema, table)
  } else {
    const analysis = analyzeUpdatableSql(source.sql)
    if (analysis.kind === 'blocked') return { ok: false, reason: analysis.reason }
    found = findRelation(tree, analysis.schema, analysis.table)
    schema = found?.schema ?? analysis.schema ?? tree?.schemas[0]?.name ?? ''
    table = found?.relation.name ?? analysis.table
  }

  const relation = found?.relation ?? null
  if (relation?.type === 'view') return { ok: false, reason: 'view' }
  if (found) {
    schema = found.schema
    table = found.relation.name
  }

  const pk = resolvePkColumns(relation, resultColumnNames, pkOverride)
  if (pk.reason) return { ok: false, reason: pk.reason }

  return {
    ok: true,
    target: {
      schema,
      table,
      pkColumns: pk.pkColumns,
      tableColumnNames: relation?.columns.map((column) => column.name) ?? []
    }
  }
}

/** Drop SET columns that do not exist on the target table (case-insensitive). */
export function filterChangesToTableColumns(
  changes: Record<string, DatabaseCellValue>,
  tableColumnNames: readonly string[]
): Record<string, DatabaseCellValue> {
  if (tableColumnNames.length === 0) return { ...changes }
  const allowed = new Set(tableColumnNames.map((name) => name.toLowerCase()))
  const next: Record<string, DatabaseCellValue> = {}
  for (const [name, value] of Object.entries(changes)) {
    if (allowed.has(name.toLowerCase())) next[name] = value
  }
  return next
}
