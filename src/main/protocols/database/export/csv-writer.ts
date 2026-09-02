import { writeFile } from 'node:fs/promises'
import { rowsToCsv } from '@shared/lib/csv-stringify'
import type { DatabaseExportOptions } from '@shared/protocols'
import type { ExportData } from './index'

export async function writeCsvExport(
  filePath: string,
  data: ExportData,
  options: DatabaseExportOptions
): Promise<void> {
  const columnNames = data.columns.map((column) => column.name)
  const content = rowsToCsv(data.rows, columnNames, {
    delimiter: options.csvDelimiter ?? ',',
    header: options.csvHeader ?? true,
    bom: options.csvBom ?? true
  })
  await writeFile(filePath, content, 'utf8')
}
