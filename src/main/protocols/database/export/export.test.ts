import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeJsonExport } from './json-writer'
import { writePdfExport } from './pdf-writer'
import { writeSqlInsertExport } from './sql-insert-writer'
import { writeXlsxExport } from './xlsx-writer'

const sample = {
  columns: [{ name: 'id' }, { name: 'name' }],
  rows: [
    { id: 1, name: 'alpha' },
    { id: 2, name: null }
  ]
}

describe('database export writers', () => {
  it('writes pretty JSON with nulls', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'north-export-'))
    const path = join(dir, 'out.json')
    try {
      await writeJsonExport(path, sample)
      const text = await readFile(path, 'utf8')
      expect(JSON.parse(text)).toEqual([
        { id: 1, name: 'alpha' },
        { id: 2, name: null }
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('writes SQL INSERT with engine-specific quoting', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'north-export-'))
    const path = join(dir, 'out.sql')
    try {
      await writeSqlInsertExport(path, sample, { sqlTableName: 'public.users' }, 'postgres')
      const text = await readFile(path, 'utf8')
      expect(text).toContain('INSERT INTO "public"."users"')
      expect(text).toContain('NULL')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('writes a valid xlsx zip archive', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'north-export-'))
    const path = join(dir, 'out.xlsx')
    try {
      await writeXlsxExport(path, sample, { xlsxHeader: true, xlsxSheetName: 'Data' })
      const bytes = await readFile(path)
      expect(bytes[0]).toBe(0x50)
      expect(bytes[1]).toBe(0x4b)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('writes a PDF document', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'north-export-'))
    const path = join(dir, 'out.pdf')
    try {
      await writePdfExport(path, sample, { pdfLandscape: true, pdfHeader: true })
      const text = await readFile(path, 'utf8')
      expect(text.startsWith('%PDF')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
