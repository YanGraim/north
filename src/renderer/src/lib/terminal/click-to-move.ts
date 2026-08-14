import type { BufferCellPos } from '@renderer/lib/terminal/mouse-cell'

export type LogicalLineBounds = {
  startY: number
  endY: number
}

export type LineCell = {
  getWidth(): number
  getChars(): string
  getCode(): number
}

export type LineRef = {
  readonly isWrapped: boolean
  readonly length: number
  getCell(x: number): LineCell | undefined
}

/** Minimal buffer surface used by pure helpers (easy to mock in tests). */
export type LineBuffer = {
  readonly cursorX: number
  readonly cursorY: number
  readonly baseY: number
  readonly length: number
  getLine(y: number): LineRef | undefined
}

export type ClickToMoveModes = {
  readonly mouseTrackingMode: 'none' | 'x10' | 'vt200' | 'drag' | 'any'
  readonly applicationCursorKeysMode: boolean
}

export type ClickToMoveTerminal = {
  readonly cols: number
  readonly buffer: { readonly active: LineBuffer & { readonly type: 'normal' | 'alternate' } }
  readonly modes: ClickToMoveModes
}

export type SelectionRange = {
  start: { x: number; y: number }
  end: { x: number; y: number }
}

export type SelectLineTerminal = {
  readonly cols: number
  readonly buffer: { readonly active: LineBuffer }
  hasSelection(): boolean
  getSelectionPosition(): SelectionRange | undefined
  select(column: number, row: number, length: number): void
  selectAll(): void
}

export type ContentRange = {
  /** Char offset where editable content starts (after a typical prompt). */
  start: number
  /** Char offset at the end of content (cursor / last glyph). */
  end: number
}

const PROMPT_MARKERS = ['# ', '$ ', '% ', '> '] as const

export function canClickToMove(term: ClickToMoveTerminal): boolean {
  if (term.buffer.active.type === 'alternate') return false
  if (term.modes.mouseTrackingMode !== 'none') return false
  if (term.modes.applicationCursorKeysMode) return false
  return true
}

export function getCursorBufferPos(buffer: LineBuffer): BufferCellPos {
  return {
    x: buffer.cursorX,
    y: buffer.baseY + buffer.cursorY
  }
}

/** Inclusive absolute buffer-line range for the wrapped logical line containing `lineY`. */
export function getLogicalLineBounds(buffer: LineBuffer, lineY: number): LogicalLineBounds {
  const maxY = Math.max(0, buffer.length - 1)
  let startY = Math.max(0, Math.min(lineY, maxY))
  while (startY > 0) {
    const line = buffer.getLine(startY)
    if (!line?.isWrapped) break
    startY--
  }
  let endY = startY
  while (endY + 1 < buffer.length) {
    const next = buffer.getLine(endY + 1)
    if (!next?.isWrapped) break
    endY++
  }
  return { startY, endY }
}

export function isInLogicalLine(bounds: LogicalLineBounds, y: number): boolean {
  return y >= bounds.startY && y <= bounds.endY
}

function countCharsInRow(buffer: LineBuffer, cols: number, row: number, endCol: number): number {
  const line = buffer.getLine(row)
  if (!line) return 0
  const limit = Math.min(Math.max(0, endCol), cols, line.length)
  let count = 0
  for (let x = 0; x < limit; x++) {
    const cell = line.getCell(x)
    if (!cell) continue
    if (cell.getWidth() === 0) continue
    count++
  }
  return count
}

/**
 * Character offset within a logical line (cells with width !== 0 count as one
 * readline movement). Positions past the row are clamped to the row width.
 */
export function bufferPosToCharOffset(
  buffer: LineBuffer,
  cols: number,
  bounds: LogicalLineBounds,
  pos: BufferCellPos
): number {
  const y = Math.max(bounds.startY, Math.min(bounds.endY, pos.y))
  let offset = 0
  for (let row = bounds.startY; row < y; row++) {
    offset += countCharsInRow(buffer, cols, row, cols)
  }
  offset += countCharsInRow(buffer, cols, y, Math.max(0, Math.min(cols, pos.x)))
  return offset
}

/** Inverse of {@link bufferPosToCharOffset}. */
export function charOffsetToBufferPos(
  buffer: LineBuffer,
  cols: number,
  bounds: LogicalLineBounds,
  offset: number
): BufferCellPos {
  let remaining = Math.max(0, offset)
  for (let row = bounds.startY; row <= bounds.endY; row++) {
    const line = buffer.getLine(row)
    if (!line) continue
    for (let x = 0; x < cols; x++) {
      const cell = line.getCell(x)
      if (!cell || cell.getWidth() === 0) continue
      if (remaining === 0) return { x, y: row }
      remaining--
    }
  }
  return {
    x: Math.min(cols, countCharsInRow(buffer, cols, bounds.endY, cols)),
    y: bounds.endY
  }
}

function cellHasContent(buffer: LineBuffer, row: number, col: number): boolean {
  const line = buffer.getLine(row)
  const cell = line?.getCell(col)
  if (!cell || cell.getWidth() === 0) return false
  return cell.getChars().length > 0 || cell.getCode() !== 0
}

/**
 * Furthest char offset you can move to on this logical line: after the last
 * non-empty cell, or at the cursor when it sits further on the same line.
 */
export function getLogicalLineEndCharOffset(
  buffer: LineBuffer,
  cols: number,
  bounds: LogicalLineBounds,
  cursor: BufferCellPos
): number {
  let contentEnd = 0
  for (let row = bounds.endY; row >= bounds.startY; row--) {
    const line = buffer.getLine(row)
    if (!line) continue
    const maxX = Math.min(cols, line.length)
    for (let x = maxX - 1; x >= 0; x--) {
      if (!cellHasContent(buffer, row, x)) continue
      contentEnd = bufferPosToCharOffset(buffer, cols, bounds, { x: x + 1, y: row })
      row = bounds.startY - 1
      break
    }
  }

  if (isInLogicalLine(bounds, cursor.y)) {
    const cursorOff = bufferPosToCharOffset(buffer, cols, bounds, cursor)
    return Math.max(contentEnd, cursorOff)
  }
  return contentEnd
}

function readLogicalLineText(
  buffer: LineBuffer,
  cols: number,
  bounds: LogicalLineBounds,
  endOffset: number
): string {
  let text = ''
  let index = 0
  for (let row = bounds.startY; row <= bounds.endY; row++) {
    const line = buffer.getLine(row)
    if (!line) continue
    for (let x = 0; x < cols; x++) {
      const cell = line.getCell(x)
      if (!cell || cell.getWidth() === 0) continue
      if (index >= endOffset) return text
      text += cell.getChars() || ' '
      index++
    }
  }
  return text
}

/**
 * Editable span on the current logical line: after a typical shell prompt
 * (`# `, `$ `, …) through the last typed character / cursor.
 */
export function getContentRange(
  buffer: LineBuffer,
  cols: number,
  bounds: LogicalLineBounds,
  cursor: BufferCellPos
): ContentRange {
  const end = getLogicalLineEndCharOffset(buffer, cols, bounds, cursor)
  const text = readLogicalLineText(buffer, cols, bounds, end)
  let start = 0
  for (const marker of PROMPT_MARKERS) {
    const at = text.lastIndexOf(marker)
    if (at >= 0) start = Math.max(start, at + marker.length)
  }
  if (start > end) start = 0
  return { start, end }
}

function cellSpan(from: BufferCellPos, to: BufferCellPos, cols: number): number {
  if (from.y === to.y) return Math.max(0, to.x - from.x)
  let span = cols - from.x
  for (let y = from.y + 1; y < to.y; y++) span += cols
  span += to.x
  return Math.max(0, span)
}

/**
 * Readline only understands single-step arrows (`ESC [ D`), not CSI counts
 * (`ESC [ 3 D`). Match xterm's own alt-click mover: repeat the key.
 */
export function buildCursorMoveSequence(fromOffset: number, toOffset: number): string | null {
  const delta = toOffset - fromOffset
  if (delta === 0) return null
  if (delta < 0) return '\x1b[D'.repeat(-delta)
  return '\x1b[C'.repeat(delta)
}

/**
 * Sequence to move the PTY cursor from its current cell to `click`, or null
 * when the click should be ignored (guards / wrong line / already there).
 */
export function resolveClickToMoveSequence(
  term: ClickToMoveTerminal,
  click: BufferCellPos
): string | null {
  if (!canClickToMove(term)) return null

  const buffer = term.buffer.active
  const cursor = getCursorBufferPos(buffer)
  const bounds = getLogicalLineBounds(buffer, cursor.y)
  if (!isInLogicalLine(bounds, click.y)) return null

  const from = bufferPosToCharOffset(buffer, term.cols, bounds, cursor)
  const end = getLogicalLineEndCharOffset(buffer, term.cols, bounds, cursor)
  const to = Math.max(0, Math.min(bufferPosToCharOffset(buffer, term.cols, bounds, click), end))
  return buildCursorMoveSequence(from, to)
}

export function isContentFullySelected(
  term: Pick<SelectLineTerminal, 'cols' | 'hasSelection' | 'getSelectionPosition' | 'buffer'>,
  bounds: LogicalLineBounds,
  content: ContentRange
): boolean {
  if (!term.hasSelection() || content.end <= content.start) return false
  const sel = term.getSelectionPosition()
  if (!sel) return false
  const start = charOffsetToBufferPos(term.buffer.active, term.cols, bounds, content.start)
  const end = charOffsetToBufferPos(term.buffer.active, term.cols, bounds, content.end)
  return (
    sel.start.x === start.x && sel.start.y === start.y && sel.end.x === end.x && sel.end.y === end.y
  )
}

/** First Mod+A selects editable content; second expands to the whole buffer. */
export function selectLogicalLineOrAll(term: SelectLineTerminal): void {
  const buffer = term.buffer.active
  const cursor = getCursorBufferPos(buffer)
  const bounds = getLogicalLineBounds(buffer, cursor.y)
  const content = getContentRange(buffer, term.cols, bounds, cursor)

  if (isContentFullySelected(term, bounds, content)) {
    term.selectAll()
    return
  }

  if (content.end <= content.start) {
    term.selectAll()
    return
  }

  const start = charOffsetToBufferPos(buffer, term.cols, bounds, content.start)
  const end = charOffsetToBufferPos(buffer, term.cols, bounds, content.end)
  const length = cellSpan(start, end, term.cols)
  if (length <= 0) {
    term.selectAll()
    return
  }
  term.select(start.x, start.y, length)
}

/**
 * Move to the end of the selection and send backspaces so the remote readline
 * deletes the selected characters (Word-like replace-with-empty).
 */
export function buildDeleteSelectionSequence(
  term: ClickToMoveTerminal & Pick<SelectLineTerminal, 'hasSelection' | 'getSelectionPosition'>
): string | null {
  if (!term.hasSelection()) return null
  const sel = term.getSelectionPosition()
  if (!sel) return null

  const buffer = term.buffer.active
  const cursor = getCursorBufferPos(buffer)
  const bounds = getLogicalLineBounds(buffer, cursor.y)
  if (!isInLogicalLine(bounds, sel.start.y) || !isInLogicalLine(bounds, sel.end.y)) {
    return null
  }

  const content = getContentRange(buffer, term.cols, bounds, cursor)
  const selStart = Math.max(
    content.start,
    bufferPosToCharOffset(buffer, term.cols, bounds, { x: sel.start.x, y: sel.start.y })
  )
  const selEnd = Math.min(
    content.end,
    bufferPosToCharOffset(buffer, term.cols, bounds, { x: sel.end.x, y: sel.end.y })
  )
  const count = selEnd - selStart
  if (count <= 0) return null

  const cursorOff = bufferPosToCharOffset(buffer, term.cols, bounds, cursor)
  const move = buildCursorMoveSequence(cursorOff, selEnd)
  return `${move ?? ''}${'\x7f'.repeat(count)}`
}
