import { describe, expect, it } from 'vitest'
import { formatCsvCell, rowsToCsv } from './csv-stringify'

describe('csv-stringify', () => {
  it('quotes fields with commas and quotes', () => {
    expect(formatCsvCell('a,b')).toBe('"a,b"')
    expect(formatCsvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('renders NULL as empty cell', () => {
    expect(formatCsvCell(null)).toBe('')
    expect(formatCsvCell(undefined)).toBe('')
  })

  it('supports semicolon delimiter and header row', () => {
    const csv = rowsToCsv([{ id: 1, name: 'a' }], ['id', 'name'], {
      delimiter: ';',
      header: true,
      bom: false
    })
    expect(csv).toBe('id;name\n1;a\n')
  })

  it('prepends UTF-8 BOM when requested', () => {
    const csv = rowsToCsv([{ id: 1 }], ['id'], {
      delimiter: ',',
      header: false,
      bom: true
    })
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })
})
