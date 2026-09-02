import type { DatabaseCellValue, DatabaseExportOptions } from '@shared/protocols'
import ExcelJS from 'exceljs'
import type { ExportData } from './index'

function exportCellValue(value: DatabaseCellValue | undefined): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean' || typeof value === 'number') return value
  return value
}

export async function writeXlsxExport(
  filePath: string,
  data: ExportData,
  options: DatabaseExportOptions
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheetName = (options.xlsxSheetName ?? 'Sheet1').slice(0, 31) || 'Sheet1'
  const sheet = workbook.addWorksheet(sheetName)
  const columnNames = data.columns.map((column) => column.name)

  if (options.xlsxHeader ?? true) {
    sheet.addRow(columnNames)
  }

  for (const row of data.rows) {
    sheet.addRow(columnNames.map((name) => exportCellValue(row[name])))
  }

  await workbook.xlsx.writeFile(filePath)
}
