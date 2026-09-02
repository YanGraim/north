import { createWriteStream } from 'node:fs'
import type { DatabaseCellValue, DatabaseExportOptions } from '@shared/protocols'
import PDFDocument from 'pdfkit'
import type { ExportData } from './index'

const PAGE_MARGIN = 28
const ROW_HEIGHT = 14
const HEADER_HEIGHT = 16
const FOOTER_HEIGHT = 14
const MAX_CELL_CHARS = 48

function truncateText(value: string): string {
  if (value.length <= MAX_CELL_CHARS) return value
  return `${value.slice(0, MAX_CELL_CHARS - 1)}…`
}

function formatPdfCell(value: DatabaseCellValue | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return truncateText(String(value))
}

export async function writePdfExport(
  filePath: string,
  data: ExportData,
  options: DatabaseExportOptions
): Promise<void> {
  const landscape = options.pdfLandscape ?? true
  const includeHeader = options.pdfHeader ?? true
  const columnNames = data.columns.map((column) => column.name)
  const columnCount = Math.max(columnNames.length, 1)
  const doc = new PDFDocument({
    size: 'A4',
    layout: landscape ? 'landscape' : 'portrait',
    margin: PAGE_MARGIN,
    autoFirstPage: true
  })

  const stream = createWriteStream(filePath)
  doc.pipe(stream)

  const pageWidth = doc.page.width - PAGE_MARGIN * 2
  const columnWidth = pageWidth / columnCount
  let pageNumber = 1
  let y = PAGE_MARGIN

  function drawFooter(): void {
    doc.fontSize(8).fillColor('#666666')
    doc.text(`página ${pageNumber}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN, {
      width: pageWidth,
      align: 'right'
    })
    doc.fillColor('#000000')
  }

  function ensureSpace(height: number): void {
    const bottom = doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT
    if (y + height <= bottom) return
    drawFooter()
    doc.addPage({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: PAGE_MARGIN })
    pageNumber += 1
    y = PAGE_MARGIN
  }

  if (includeHeader) {
    ensureSpace(HEADER_HEIGHT)
    doc.fontSize(9).font('Helvetica-Bold')
    columnNames.forEach((name, index) => {
      doc.text(truncateText(name), PAGE_MARGIN + index * columnWidth, y, {
        width: columnWidth - 4,
        lineBreak: false
      })
    })
    doc.font('Helvetica')
    y += HEADER_HEIGHT
  }

  for (const row of data.rows) {
    ensureSpace(ROW_HEIGHT)
    columnNames.forEach((name, index) => {
      doc.fontSize(8).text(formatPdfCell(row[name]), PAGE_MARGIN + index * columnWidth, y, {
        width: columnWidth - 4,
        lineBreak: false
      })
    })
    y += ROW_HEIGHT
  }

  drawFooter()
  doc.end()

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', reject)
    doc.on('error', reject)
  })
}
