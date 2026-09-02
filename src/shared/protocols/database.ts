import { z } from 'zod'
import { DatabaseEngineSchema } from '../types/access'

export const SQL_STUDIO_ENGINES = ['postgres', 'mysql', 'mariadb', 'mssql', 'sqlite'] as const

export const SqlStudioEngineSchema = z.enum(SQL_STUDIO_ENGINES)
export type SqlStudioEngine = z.infer<typeof SqlStudioEngineSchema>

export const DATABASE_QUERY_TIMEOUT_MS = 30_000
export const DATABASE_MAX_ROWS = 1_000
export const DATABASE_EXPORT_MAX_ROWS = 100_000
export const DATABASE_EXPORT_PDF_MAX_ROWS = 5_000
export const DATABASE_EXPORT_TIMEOUT_MS = 5 * 60 * 1000

export function isSqlStudioEngine(engine: string | null | undefined): engine is SqlStudioEngine {
  return (
    engine === 'postgres' ||
    engine === 'mysql' ||
    engine === 'mariadb' ||
    engine === 'mssql' ||
    engine === 'sqlite'
  )
}

export const DatabaseColumnSchema = z.object({
  name: z.string().min(1),
  dataType: z.string().min(1),
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  characterMaximumLength: z.number().int().nullable().optional()
})
export type DatabaseColumn = z.infer<typeof DatabaseColumnSchema>

export const DatabaseRelationKindSchema = z.enum(['table', 'view'])
export type DatabaseRelationKind = z.infer<typeof DatabaseRelationKindSchema>

export const DatabaseRelationSchema = z.object({
  name: z.string().min(1),
  type: DatabaseRelationKindSchema,
  columns: z.array(DatabaseColumnSchema)
})
export type DatabaseRelation = z.infer<typeof DatabaseRelationSchema>

export const DatabaseSchemaNodeSchema = z.object({
  name: z.string().min(1),
  tables: z.array(DatabaseRelationSchema)
})
export type DatabaseSchemaNode = z.infer<typeof DatabaseSchemaNodeSchema>

export const DatabaseIntrospectionSchema = z.object({
  schemas: z.array(DatabaseSchemaNodeSchema)
})
export type DatabaseIntrospection = z.infer<typeof DatabaseIntrospectionSchema>

export const DatabaseCellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
export type DatabaseCellValue = z.infer<typeof DatabaseCellValueSchema>

export const DatabaseQueryColumnSchema = z.object({
  name: z.string().min(1),
  dataType: z.string().optional()
})
export type DatabaseQueryColumn = z.infer<typeof DatabaseQueryColumnSchema>

export const DatabaseQueryResultSchema = z.object({
  columns: z.array(DatabaseQueryColumnSchema),
  rows: z.array(z.record(z.string(), DatabaseCellValueSchema)),
  rowCount: z.number().int().nonnegative(),
  affectedRows: z.number().int().nonnegative().nullable(),
  durationMs: z.number().nonnegative(),
  truncated: z.boolean()
})
export type DatabaseQueryResult = z.infer<typeof DatabaseQueryResultSchema>

export const DatabaseExportFormatSchema = z.enum(['csv', 'json', 'xlsx', 'pdf', 'sql'])
export type DatabaseExportFormat = z.infer<typeof DatabaseExportFormatSchema>

export const DatabaseExportOptionsSchema = z.object({
  csvHeader: z.boolean().optional(),
  csvDelimiter: z.enum([',', ';']).optional(),
  csvBom: z.boolean().optional(),
  xlsxHeader: z.boolean().optional(),
  xlsxSheetName: z.string().optional(),
  pdfLandscape: z.boolean().optional(),
  pdfHeader: z.boolean().optional(),
  sqlTableName: z.string().optional()
})
export type DatabaseExportOptions = z.infer<typeof DatabaseExportOptionsSchema>

export const DbExportQueryInputSchema = z.object({
  source: z.literal('query'),
  sessionId: z.string().uuid(),
  sql: z.string().min(1),
  format: DatabaseExportFormatSchema,
  options: DatabaseExportOptionsSchema,
  suggestedName: z.string().min(1)
})
export type DbExportQueryInput = z.infer<typeof DbExportQueryInputSchema>

export const DbExportRowsInputSchema = z.object({
  source: z.literal('rows'),
  columns: z.array(DatabaseQueryColumnSchema),
  rows: z.array(z.record(z.string(), DatabaseCellValueSchema)),
  format: DatabaseExportFormatSchema,
  options: DatabaseExportOptionsSchema,
  suggestedName: z.string().min(1),
  engine: SqlStudioEngineSchema.optional()
})
export type DbExportRowsInput = z.infer<typeof DbExportRowsInputSchema>

export const DbExportInputSchema = z.discriminatedUnion('source', [
  DbExportQueryInputSchema,
  DbExportRowsInputSchema
])
export type DbExportInput = z.infer<typeof DbExportInputSchema>

export const DbExportResultSchema = z.object({
  canceled: z.boolean(),
  filePath: z.string().nullable(),
  rowCount: z.number().int().nonnegative(),
  truncated: z.boolean()
})
export type DbExportResult = z.infer<typeof DbExportResultSchema>

export const DatabaseTestInputSchema = z.object({
  engine: DatabaseEngineSchema,
  host: z.string().nullable().optional(),
  port: z.number().int().positive().nullable().optional(),
  database: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  ssl: z.boolean().nullable().optional(),
  password: z.string().optional(),
  credentialRef: z.string().nullable().optional(),
  accessId: z.string().uuid().optional()
})
export type DatabaseTestInput = z.infer<typeof DatabaseTestInputSchema>

export const DatabaseTestResultSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional()
})
export type DatabaseTestResult = z.infer<typeof DatabaseTestResultSchema>

export const DbIntrospectInputSchema = z.object({
  sessionId: z.string().uuid()
})
export type DbIntrospectInput = z.infer<typeof DbIntrospectInputSchema>

export const DbQueryInputSchema = z.object({
  sessionId: z.string().uuid(),
  sql: z.string().min(1)
})
export type DbQueryInput = z.infer<typeof DbQueryInputSchema>

export const DbCancelInputSchema = z.object({
  sessionId: z.string().uuid()
})
export type DbCancelInput = z.infer<typeof DbCancelInputSchema>

export const DatabaseTxStateSchema = z.object({
  autoCommit: z.boolean(),
  inTransaction: z.boolean()
})
export type DatabaseTxState = z.infer<typeof DatabaseTxStateSchema>

export const DbTxStateInputSchema = z.object({
  sessionId: z.string().uuid()
})
export type DbTxStateInput = z.infer<typeof DbTxStateInputSchema>

export const DbSetAutoCommitInputSchema = z.object({
  sessionId: z.string().uuid(),
  autoCommit: z.boolean()
})
export type DbSetAutoCommitInput = z.infer<typeof DbSetAutoCommitInputSchema>

export const DbCommitInputSchema = z.object({
  sessionId: z.string().uuid()
})
export type DbCommitInput = z.infer<typeof DbCommitInputSchema>

export const DbRollbackInputSchema = z.object({
  sessionId: z.string().uuid()
})
export type DbRollbackInput = z.infer<typeof DbRollbackInputSchema>

export const OpenAccessSessionInputSchema = z.object({
  accessId: z.string().uuid()
})
export type OpenAccessSessionInput = z.infer<typeof OpenAccessSessionInputSchema>
