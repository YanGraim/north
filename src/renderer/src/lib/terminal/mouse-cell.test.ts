import {
  clientPointToViewportCell,
  viewportCellToBufferPos
} from '@renderer/lib/terminal/mouse-cell'
import { describe, expect, it } from 'vitest'

describe('clientPointToViewportCell', () => {
  const screen = { left: 100, top: 50, width: 800, height: 400, right: 900, bottom: 450 }

  it('maps the top-left cell', () => {
    expect(clientPointToViewportCell(screen, 80, 24, 100, 50)).toEqual({ col: 0, row: 0 })
  })

  it('maps a mid-screen point using xterm-like ceil math', () => {
    // cellW=10, cellH≈16.666; (500-100)/10 = 40 → ceil(40)-1 = 39
    // (250-50)/16.666 ≈ 12 → ceil(12)-1 = 11
    expect(clientPointToViewportCell(screen, 80, 24, 500, 250)).toEqual({ col: 39, row: 11 })
  })

  it('returns null outside the screen or with invalid dims', () => {
    expect(clientPointToViewportCell(screen, 80, 24, 50, 50)).toBeNull()
    expect(clientPointToViewportCell(screen, 80, 24, 100, 501)).toBeNull()
    expect(clientPointToViewportCell({ ...screen, width: 0 }, 80, 24, 100, 50)).toBeNull()
  })
})

describe('viewportCellToBufferPos', () => {
  it('adds viewportY to the row', () => {
    expect(viewportCellToBufferPos(100, { col: 12, row: 3 })).toEqual({ x: 12, y: 103 })
  })
})
