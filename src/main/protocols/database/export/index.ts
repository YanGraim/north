import type {
  DatabaseCellValue,
  DatabaseExportFormat,
  DatabaseExportOptions,
  DatabaseQueryColumn,
  SqlStudioEngine
} from '@shared/protocols'
import { writeCsvExport } from './csv-writer'
import { writeJsonExport } from './json-writer'
import { writePdfExport } from './pdf-writer'
import { writeSqlInsertExport } from './sql-insert-writer'
import { writeXlsxExport } from './xlsx-writer'

export type ExportData = {
  columns: DatabaseQueryColumn[]
  rows: Array<Record<string, DatabaseCellValue>>
}

export const EXPORT_EXTENSIONS: Record<DatabaseExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  xlsx: 'xlsx',
  pdf: 'pdf',
  sql: 'sql'
}

export const EXPORT_FILTER_NAMES: Record<DatabaseExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  xlsx: 'Excel',
  pdf: 'PDF',
  sql: 'SQL'
}

export type ExportWriterContext = {
  engine?: SqlStudioEngine
}

export type ExportWriter = (
  filePath: string,
  data: ExportData,
  options: DatabaseExportOptions,
  context: ExportWriterContext
) => Promise<void>

export const exportWriters: Record<DatabaseExportFormat, ExportWriter> = {
  csv: (path, data, options) => writeCsvExport(path, data, options),
  json: (path, data) => writeJsonExport(path, data),
  xlsx: (path, data, options) => writeXlsxExport(path, data, options),
  pdf: (path, data, options) => writePdfExport(path, data, options),
  sql: (path, data, options, context) => {
    if (!context.engine) throw new Error('Engine is required for SQL INSERT export')
    return writeSqlInsertExport(path, data, options, context.engine)
  }
}

export async function writeExport(
  filePath: string,
  format: DatabaseExportFormat,
  data: ExportData,
  options: DatabaseExportOptions,
  context: ExportWriterContext = {}
): Promise<void> {
  await exportWriters[format](filePath, data, options, context)
}

export { writeCsvExport } from './csv-writer'
export { writeJsonExport } from './json-writer'
export { writePdfExport } from './pdf-writer'
export { writeSqlInsertExport } from './sql-insert-writer'
export { writeXlsxExport } from './xlsx-writer'
