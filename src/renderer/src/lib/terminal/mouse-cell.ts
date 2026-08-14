import type { Terminal } from '@xterm/xterm'

export type ViewportCell = {
  col: number
  row: number
}

export type BufferCellPos = {
  /** 0-based column */
  x: number
  /** Absolute buffer line index */
  y: number
}

export type ScreenBox = {
  left: number
  top: number
  width: number
  height: number
}

export function getXtermScreenElement(term: Terminal): HTMLElement | null {
  return (term.element?.querySelector('.xterm-screen') as HTMLElement | null) ?? null
}

/**
 * Map a client point to a 0-based viewport cell.
 * Mirrors xterm's own mouse math: ceil(offset / cellSize) then convert from 1-based.
 */
export function clientPointToViewportCell(
  screen: ScreenBox,
  cols: number,
  rows: number,
  clientX: number,
  clientY: number
): ViewportCell | null {
  if (cols <= 0 || rows <= 0 || screen.width <= 0 || screen.height <= 0) return null
  const cellW = screen.width / cols
  const cellH = screen.height / rows
  if (cellW <= 0 || cellH <= 0) return null

  const relX = clientX - screen.left
  const relY = clientY - screen.top
  if (relX < 0 || relY < 0 || relX > screen.width || relY > screen.height) return null

  let col = Math.ceil(relX / cellW) - 1
  let row = Math.ceil(relY / cellH) - 1
  col = Math.max(0, Math.min(cols - 1, col))
  row = Math.max(0, Math.min(rows - 1, row))
  return { col, row }
}

export function viewportCellToBufferPos(viewportY: number, cell: ViewportCell): BufferCellPos {
  return { x: cell.col, y: viewportY + cell.row }
}
