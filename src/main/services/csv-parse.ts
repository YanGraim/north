/**
 * Minimal RFC 4180-ish CSV parser (UTF-8).
 * Supports quoted fields, escaped quotes (`""`), and commas inside quotes.
 */

export type CsvParseResult = {
  headers: string[]
  records: Array<Record<string, string>>
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase()
}

/**
 * Parse a full CSV document into header + row records.
 * Empty trailing lines are ignored. Throws on malformed quotes.
 */
export function parseCsv(content: string): CsvParseResult {
  const rows = parseCsvRows(content)
  if (rows.length === 0) {
    throw new Error('CSV vazio')
  }

  const headers = rows[0].map(normalizeHeader)
  if (headers.length === 0 || headers.every((h) => h === '')) {
    throw new Error('Cabeçalho CSV ausente')
  }

  const records: Array<Record<string, string>> = []
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    if (cells.length === 1 && cells[0].trim() === '') continue
    if (cells.every((c) => c.trim() === '')) continue

    const record: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]
      if (!key) continue
      record[key] = cells[c] ?? ''
    }
    records.push(record)
  }

  return { headers, records }
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const text = content.replace(/^\uFEFF/, '')

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (ch === '\r') {
      continue
    }

    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    field += ch
  }

  if (inQuotes) {
    throw new Error('Aspas não fechadas no CSV')
  }

  // Last field / row (file may or may not end with newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
