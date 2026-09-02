import { writeFile } from 'node:fs/promises'
import { qualifyRelation, quoteIdent, quoteLiteral } from '@shared/lib/sql-ident'
import type { DatabaseExportOptions, SqlStudioEngine } from '@shared/protocols'
import type { ExportData } from './index'

const INSERT_BATCH_HINT = 100

function qualifyTableName(engine: SqlStudioEngine, tableName: string): string {
  const trimmed = tableName.trim()
  const parts = trimmed.split('.').filter(Boolean)
  if (parts.length >= 2) {
    return qualifyRelation(engine, parts.at(-2) ?? null, parts.at(-1) ?? trimmed)
  }
  return quoteIdent(engine, trimmed)
}

export async function writeSqlInsertExport(
  filePath: string,
  data: ExportData,
  options: DatabaseExportOptions,
  engine: SqlStudioEngine
): Promise<void> {
  const tableSql = qualifyTableName(engine, options.sqlTableName ?? 'exported_data')
  const columnNames = data.columns.map((column) => column.name)
  const idents = columnNames.map((name) => quoteIdent(engine, name))
  const lines: string[] = []

  for (let index = 0; index < data.rows.length; index += 1) {
    if (index > 0 && index % INSERT_BATCH_HINT === 0) {
      lines.push('')
    }
    const row = data.rows[index]
    if (!row) continue
    const values = columnNames.map((name) => quoteLiteral(engine, row[name] ?? null))
    lines.push(`INSERT INTO ${tableSql} (${idents.join(', ')}) VALUES (${values.join(', ')});`)
  }

  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8')
}
