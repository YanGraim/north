import type { DatabaseCellValue } from '../protocols/database'

export type CsvStringifyOptions = {
  delimiter: ',' | ';'
  header: boolean
  bom: boolean
}

export function formatCsvCell(value: DatabaseCellValue | undefined): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  if (/[\n\r",]/.test(text) || text.includes(String.fromCharCode(0))) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function rowsToCsv(
  rows: Array<Record<string, DatabaseCellValue>>,
  columnNames: readonly string[],
  options: CsvStringifyOptions
): string {
  const lines: string[] = []
  if (options.header) {
    lines.push(columnNames.map((name) => formatCsvCell(name)).join(options.delimiter))
  }
  for (const row of rows) {
    lines.push(columnNames.map((name) => formatCsvCell(row[name])).join(options.delimiter))
  }
  const body = `${lines.join('\n')}\n`
  return options.bom ? `\uFEFF${body}` : body
}
