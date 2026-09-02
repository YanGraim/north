import type { DatabaseCellValue, SqlStudioEngine } from '../protocols/database'
import type { DatabaseEngine } from '../types/access'
import { keywordAt, skipTrivia, splitTopLevelStatements, walkTopLevelTokens } from './sql-scan'

export function quoteIdent(engine: DatabaseEngine, ident: string): string {
  switch (engine) {
    case 'mysql':
    case 'mariadb':
      return `\`${ident.replaceAll('`', '``')}\``
    case 'mssql':
      return `[${ident.replaceAll(']', ']]')}]`
    default:
      return `"${ident.replaceAll('"', '""')}"`
  }
}

export function quoteLiteral(engine: DatabaseEngine, value: DatabaseCellValue): string {
  if (value === null) return 'NULL'
  if (typeof value === 'boolean') {
    if (engine === 'postgres') return value ? 'TRUE' : 'FALSE'
    return value ? '1' : '0'
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid numeric literal')
    return String(value)
  }
  return `'${value.replaceAll("'", "''")}'`
}

export function qualifyRelation(
  engine: DatabaseEngine,
  schema: string | null | undefined,
  table: string
): string {
  const tableSql = quoteIdent(engine, table)
  if (!schema || (engine === 'sqlite' && schema === 'main')) return tableSql
  return `${quoteIdent(engine, schema)}.${tableSql}`
}

function whereEquals(
  engine: DatabaseEngine,
  column: string,
  value: DatabaseCellValue | undefined
): string {
  const ident = quoteIdent(engine, column)
  if (value === null || value === undefined) return `${ident} IS NULL`
  return `${ident} = ${quoteLiteral(engine, value)}`
}

/**
 * Builds a single-row UPDATE using PK columns for the WHERE clause.
 * Throws when there is no primary key or no column changes.
 */
export function buildRowUpdateSql(
  engine: SqlStudioEngine,
  schema: string | null,
  table: string,
  primaryKeyColumns: readonly string[],
  originalRow: Record<string, DatabaseCellValue>,
  changes: Record<string, DatabaseCellValue>
): string {
  if (primaryKeyColumns.length === 0) {
    throw new Error('Cannot update a table without a primary key')
  }
  const entries = Object.entries(changes)
  if (entries.length === 0) {
    throw new Error('No changes to save')
  }
  const setClauses = entries.map(
    ([column, value]) => `${quoteIdent(engine, column)} = ${quoteLiteral(engine, value)}`
  )
  const whereClauses = primaryKeyColumns.map((column) =>
    whereEquals(engine, column, originalRow[column])
  )
  return `UPDATE ${qualifyRelation(engine, schema, table)} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`
}

/** Page size for table-tab browse (DBeaver-style fetch). */
export const TABLE_BROWSE_PAGE_SIZE = 100

/** Soft cap in the renderer: stop appending pages to avoid locking the UI. */
export const TABLE_BROWSE_SOFT_CAP = 20_000

/**
 * SQL that lists primary-key column names for one relation.
 * Result column should be readable as `column_name` (or the first field).
 */
export function primaryKeyLookupSql(
  engine: SqlStudioEngine,
  schema: string,
  table: string
): string {
  const schemaLit = quoteLiteral(engine, schema)
  const tableLit = quoteLiteral(engine, table)
  switch (engine) {
    case 'postgres':
      return `SELECT a.attname AS column_name
FROM pg_index i
JOIN pg_class c ON c.oid = i.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a
  ON a.attrelid = c.oid
 AND a.attnum = ANY (i.indkey)
 AND a.attnum > 0
 AND NOT a.attisdropped
WHERE i.indisprimary
  AND n.nspname = ${schemaLit}
  AND c.relname = ${tableLit}`
    case 'mysql':
    case 'mariadb':
      return `SELECT column_name AS column_name
FROM information_schema.key_column_usage
WHERE table_schema = ${schemaLit}
  AND table_name = ${tableLit}
  AND constraint_name = 'PRIMARY'
ORDER BY ordinal_position`
    case 'mssql':
      return `SELECT c.name AS column_name
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
JOIN sys.tables t ON i.object_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE i.is_primary_key = 1
  AND s.name = ${schemaLit}
  AND t.name = ${tableLit}
ORDER BY ic.key_ordinal`
    case 'sqlite':
      return `SELECT name AS column_name
FROM pragma_table_info(${tableLit})
WHERE pk > 0
ORDER BY pk`
  }
}

export function previewSelectSql(
  engine: SqlStudioEngine,
  schema: string | null,
  table: string
): string {
  return tableBrowseSql(engine, schema, table, '')
}

const FULL_SQL_START =
  /^(select|with|insert|update|delete|create|drop|alter|pragma|explain|show|describe|desc|values|begin|commit|rollback|call|exec|execute|merge|truncate)\b/i

export function isFullSqlStatement(text: string): boolean {
  const trimmed = text.trim().replace(/^\uFEFF/, '')
  return FULL_SQL_START.test(trimmed)
}

function stripWhereKeyword(filter: string): string {
  return filter.replace(/^\s*where\s+/i, '').trim()
}

function mssqlOrderByClause(engine: SqlStudioEngine, orderBy?: readonly string[]): string {
  if (orderBy && orderBy.length > 0) {
    return orderBy.map((column) => quoteIdent(engine, column)).join(', ')
  }
  return '1'
}

/**
 * Paged browse SQL for a table tab.
 * Full SQL in the filter bar is returned as-is (no LIMIT/OFFSET).
 * MSSQL uses ORDER BY (PK columns or 1) + OFFSET/FETCH.
 */
export function tableBrowsePageSql(
  engine: SqlStudioEngine,
  schema: string | null,
  table: string,
  filter: string,
  offset: number,
  limit: number,
  orderBy?: readonly string[]
): string {
  const trimmed = filter.trim()
  if (trimmed && isFullSqlStatement(trimmed)) return trimmed
  const safeOffset = Math.max(0, Math.floor(offset))
  const safeLimit = Math.max(1, Math.floor(limit))
  const ident = qualifyRelation(engine, schema, table)
  const where = trimmed ? ` WHERE ${stripWhereKeyword(trimmed)}` : ''
  if (engine === 'mssql') {
    const order = mssqlOrderByClause(engine, orderBy)
    return `SELECT * FROM ${ident}${where} ORDER BY ${order} OFFSET ${safeOffset} ROWS FETCH NEXT ${safeLimit} ROWS ONLY`
  }
  return `SELECT * FROM ${ident}${where} LIMIT ${safeLimit} OFFSET ${safeOffset}`
}

/** First page of a table tab browse (empty/WHERE filter, or a full statement as-is). */
export function tableBrowseSql(
  engine: SqlStudioEngine,
  schema: string | null,
  table: string,
  filter: string,
  orderBy?: readonly string[]
): string {
  return tableBrowsePageSql(engine, schema, table, filter, 0, TABLE_BROWSE_PAGE_SIZE, orderBy)
}

/**
 * Full-table export SQL (no LIMIT/OFFSET). Full SQL in the filter bar is returned as-is.
 * MSSQL adds ORDER BY when missing so exports are deterministic.
 */
export function tableExportSql(
  engine: SqlStudioEngine,
  schema: string | null,
  table: string,
  filter: string,
  orderBy?: readonly string[]
): string {
  const trimmed = filter.trim()
  if (trimmed && isFullSqlStatement(trimmed)) return trimmed
  const ident = qualifyRelation(engine, schema, table)
  const where = trimmed ? ` WHERE ${stripWhereKeyword(trimmed)}` : ''
  if (engine === 'mssql') {
    const order = mssqlOrderByClause(engine, orderBy)
    return `SELECT * FROM ${ident}${where} ORDER BY ${order}`
  }
  return `SELECT * FROM ${ident}${where}`
}

function hasTopLevelPagingKeyword(sql: string): boolean {
  let blocked = false
  let afterSelect = false
  const i = skipTrivia(sql, 0)
  const first = keywordAt(sql, i)
  if (first?.keyword === 'select') afterSelect = true
  walkTopLevelTokens(sql, (keyword) => {
    if (keyword === 'limit' || keyword === 'offset' || keyword === 'fetch') blocked = true
    if (afterSelect && keyword === 'top') blocked = true
    if (keyword === 'select') afterSelect = true
    if (keyword === 'from') afterSelect = false
  })
  return blocked
}

function hasTopLevelOrderBy(sql: string): boolean {
  let hasOrder = false
  walkTopLevelTokens(sql, (keyword, _index, next) => {
    if (keyword !== 'order') return
    const by = keywordAt(sql, next)
    if (by?.keyword === 'by') hasOrder = true
  })
  return hasOrder
}

function isPageableResultSql(sql: string): boolean {
  const statements = splitTopLevelStatements(sql)
  if (statements.length !== 1) return false
  const text = statements[0]?.text ?? ''
  const first = keywordAt(text, skipTrivia(text, 0))
  if (!first || (first.keyword !== 'select' && first.keyword !== 'with')) return false

  let hasSelect = first.keyword === 'select'
  let hasDml = false
  walkTopLevelTokens(text, (keyword) => {
    if (keyword === 'select') hasSelect = true
    if (
      keyword === 'insert' ||
      keyword === 'update' ||
      keyword === 'delete' ||
      keyword === 'merge'
    ) {
      hasDml = true
    }
  })
  if (!hasSelect || hasDml) return false
  return !hasTopLevelPagingKeyword(text)
}

/**
 * Append LIMIT/OFFSET (or MSSQL OFFSET/FETCH) to a single SELECT/WITH.
 * Returns null when the SQL already pages, has multiple statements, or is not a SELECT.
 * Does not wrap in a subquery — ORDER BY stays on the original statement.
 */
export function queryResultPageSql(
  engine: SqlStudioEngine,
  sql: string,
  offset: number,
  limit: number
): string | null {
  const trimmed = sql.trim().replace(/^\uFEFF/, '')
  if (!isPageableResultSql(trimmed)) return null
  const safeOffset = Math.max(0, Math.floor(offset))
  const safeLimit = Math.max(1, Math.floor(limit))
  const body = trimmed.replace(/;\s*$/, '')
  if (engine === 'mssql') {
    const order = hasTopLevelOrderBy(body) ? '' : ' ORDER BY (SELECT NULL)'
    return `${body}${order} OFFSET ${safeOffset} ROWS FETCH NEXT ${safeLimit} ROWS ONLY`
  }
  return `${body} LIMIT ${safeLimit} OFFSET ${safeOffset}`
}
