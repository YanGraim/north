import type { DatabaseCellValue, DatabaseColumn, SqlStudioEngine } from '../protocols/database'
import { qualifyRelation, quoteIdent } from './sql-ident'

export function primaryKeyColumnNames(columns: readonly DatabaseColumn[]): string[] {
  return columns.filter((column) => column.primaryKey).map((column) => column.name)
}

/**
 * Map introspected PK names onto result-set column names (case-insensitive).
 * Postgres/drivers may return `ID` in the grid while introspection has `id`.
 */
export function alignPrimaryKeyNames(
  pkColumns: readonly string[],
  resultColumnNames: readonly string[]
): string[] {
  if (pkColumns.length === 0) return []
  if (resultColumnNames.length === 0) return [...pkColumns]
  return pkColumns.map((pk) => {
    const exact = resultColumnNames.find((name) => name === pk)
    if (exact) return exact
    const lower = pk.toLowerCase()
    return resultColumnNames.find((name) => name.toLowerCase() === lower) ?? pk
  })
}

function rowCellValue(
  row: Record<string, DatabaseCellValue>,
  column: string
): DatabaseCellValue | undefined {
  if (Object.hasOwn(row, column)) return row[column]
  const lower = column.toLowerCase()
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === lower) return row[key]
  }
  return undefined
}

export function quoteSqlLiteral(value: DatabaseCellValue): string {
  if (value === null) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid numeric cell value')
    return String(value)
  }
  return `'${value.replaceAll("'", "''")}'`
}

export type RowUpdateInput = {
  engine: SqlStudioEngine
  schema: string
  table: string
  pkColumns: readonly string[]
  original: Record<string, DatabaseCellValue>
  changes: Record<string, DatabaseCellValue>
}

export type RowDeleteInput = {
  engine: SqlStudioEngine
  schema: string
  table: string
  pkColumns: readonly string[]
  original: Record<string, DatabaseCellValue>
}

export type RowInsertInput = {
  engine: SqlStudioEngine
  schema: string
  table: string
  values: Record<string, DatabaseCellValue>
}

function requirePk(pkColumns: readonly string[]): void {
  if (pkColumns.length === 0) {
    throw new Error('Cannot save without a primary key')
  }
}

function wherePrimaryKey(
  engine: SqlStudioEngine,
  pkColumns: readonly string[],
  original: Record<string, DatabaseCellValue>
): string {
  return pkColumns
    .map((column) => {
      const value = rowCellValue(original, column)
      if (value === undefined) {
        throw new Error(`Missing primary key value for column ${column}`)
      }
      return `${quoteIdent(engine, column)} = ${quoteSqlLiteral(value)}`
    })
    .join(' AND ')
}

/** Builds a single-row UPDATE. Throws if the table has no primary key. */
export function buildRowUpdateSql(input: RowUpdateInput): string {
  const { engine, schema, table, pkColumns, original, changes } = input
  requirePk(pkColumns)
  const changeEntries = Object.entries(changes)
  if (changeEntries.length === 0) {
    throw new Error('No cell changes to save')
  }

  const setClause = changeEntries
    .map(([column, value]) => `${quoteIdent(engine, column)} = ${quoteSqlLiteral(value)}`)
    .join(', ')

  return `UPDATE ${qualifyRelation(engine, schema, table)} SET ${setClause} WHERE ${wherePrimaryKey(engine, pkColumns, original)}`
}

/** Builds a single-row DELETE by primary key. */
export function buildRowDeleteSql(input: RowDeleteInput): string {
  const { engine, schema, table, pkColumns, original } = input
  requirePk(pkColumns)
  return `DELETE FROM ${qualifyRelation(engine, schema, table)} WHERE ${wherePrimaryKey(engine, pkColumns, original)}`
}

/**
 * Builds INSERT. Null values are omitted so serial/identity PKs can use defaults.
 * Throws if every column is null (nothing to insert).
 */
export function buildRowInsertSql(input: RowInsertInput): string {
  const { engine, schema, table, values } = input
  const entries = Object.entries(values).filter(([, value]) => value !== null)
  if (entries.length === 0) {
    throw new Error('Nothing to insert — all columns are null')
  }
  const columns = entries.map(([column]) => quoteIdent(engine, column)).join(', ')
  const literals = entries.map(([, value]) => quoteSqlLiteral(value)).join(', ')
  return `INSERT INTO ${qualifyRelation(engine, schema, table)} (${columns}) VALUES (${literals})`
}

export function buildUpdatesFromPayloads(
  engine: SqlStudioEngine,
  schema: string,
  table: string,
  pkColumns: readonly string[],
  payloads: ReadonlyArray<{
    original: Record<string, DatabaseCellValue>
    changes: Record<string, DatabaseCellValue>
  }>
): string[] {
  requirePk(pkColumns)
  return payloads.map((payload) =>
    buildRowUpdateSql({
      engine,
      schema,
      table,
      pkColumns,
      original: payload.original,
      changes: payload.changes
    })
  )
}

export type MutationBatchInput = {
  engine: SqlStudioEngine
  schema: string
  table: string
  pkColumns: readonly string[]
  deletes: ReadonlyArray<Record<string, DatabaseCellValue>>
  updates: ReadonlyArray<{
    original: Record<string, DatabaseCellValue>
    changes: Record<string, DatabaseCellValue>
  }>
  inserts: ReadonlyArray<Record<string, DatabaseCellValue>>
}

/**
 * Ordered statements for a logical save: DELETE → UPDATE → INSERT.
 * Stops being the caller's responsibility if one fails mid-loop.
 */
export function buildMutationStatements(input: MutationBatchInput): string[] {
  const { engine, schema, table, pkColumns, deletes, updates, inserts } = input
  if (deletes.length > 0 || updates.length > 0) {
    requirePk(pkColumns)
  }
  const statements: string[] = []
  for (const original of deletes) {
    statements.push(buildRowDeleteSql({ engine, schema, table, pkColumns, original }))
  }
  for (const payload of updates) {
    statements.push(
      buildRowUpdateSql({
        engine,
        schema,
        table,
        pkColumns,
        original: payload.original,
        changes: payload.changes
      })
    )
  }
  for (const values of inserts) {
    statements.push(buildRowInsertSql({ engine, schema, table, values }))
  }
  return statements
}
