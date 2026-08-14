import type { DatabaseCellValue } from '@shared/protocols'

export function serializeCell(value: unknown): DatabaseCellValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) {
    if (value.length === 0) return ''
    return `\\x${value.toString('hex')}`
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView
    const bytes = Buffer.from(view.buffer, view.byteOffset, view.byteLength)
    return `\\x${bytes.toString('hex')}`
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function serializeRow(
  columns: string[],
  raw: Record<string, unknown> | unknown[]
): Record<string, DatabaseCellValue> {
  const row: Record<string, DatabaseCellValue> = {}
  if (Array.isArray(raw)) {
    for (let i = 0; i < columns.length; i++) {
      const name = columns[i] ?? `col_${i}`
      row[name] = serializeCell(raw[i])
    }
    return row
  }
  for (const name of columns) {
    row[name] = serializeCell(raw[name])
  }
  return row
}
