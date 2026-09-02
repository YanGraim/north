import { writeFile } from 'node:fs/promises'
import type { ExportData } from './index'

export async function writeJsonExport(filePath: string, data: ExportData): Promise<void> {
  const columnNames = data.columns.map((column) => column.name)
  const objects = data.rows.map((row) => {
    const next: Record<string, unknown> = {}
    for (const name of columnNames) {
      next[name] = row[name] ?? null
    }
    return next
  })
  await writeFile(filePath, `${JSON.stringify(objects, null, 2)}\n`, 'utf8')
}
