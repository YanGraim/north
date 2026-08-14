import {
  bufferPosToCharOffset,
  buildCursorMoveSequence,
  buildDeleteSelectionSequence,
  canClickToMove,
  charOffsetToBufferPos,
  getContentRange,
  getCursorBufferPos,
  getLogicalLineBounds,
  getLogicalLineEndCharOffset,
  isContentFullySelected,
  isInLogicalLine,
  type LineBuffer,
  resolveClickToMoveSequence,
  selectLogicalLineOrAll
} from '@renderer/lib/terminal/click-to-move'
import { describe, expect, it, vi } from 'vitest'

type MockCell = { width: number; chars: string; code: number }

type MockLine = {
  isWrapped: boolean
  cells: MockCell[]
}

function cell(chars: string, width = 1): MockCell {
  return { width, chars, code: chars ? chars.charCodeAt(0) : 0 }
}

function empty(count: number): MockCell[] {
  return Array.from({ length: count }, () => cell(''))
}

function cellsFrom(text: string): MockCell[] {
  return [...text].map((ch) => cell(ch))
}

function makeBuffer(
  lines: MockLine[],
  cursorX: number,
  cursorY: number,
  options: { baseY?: number; type?: 'normal' | 'alternate' } = {}
): LineBuffer & { type: 'normal' | 'alternate'; viewportY: number } {
  const baseY = options.baseY ?? 0
  return {
    type: options.type ?? 'normal',
    cursorX,
    cursorY,
    baseY,
    viewportY: baseY,
    length: lines.length,
    getLine(y: number) {
      const line = lines[y]
      if (!line) return undefined
      return {
        isWrapped: line.isWrapped,
        length: line.cells.length,
        getCell(x: number) {
          const c = line.cells[x]
          if (!c) return undefined
          return {
            getWidth: () => c.width,
            getChars: () => c.chars,
            getCode: () => c.code
          }
        }
      }
    }
  }
}

function makeTerm(
  buffer: ReturnType<typeof makeBuffer>,
  cols: number,
  modes: {
    mouseTrackingMode?: 'none' | 'x10' | 'vt200' | 'drag' | 'any'
    applicationCursorKeysMode?: boolean
  } = {}
) {
  return {
    cols,
    buffer: { active: buffer },
    modes: {
      mouseTrackingMode: modes.mouseTrackingMode ?? ('none' as const),
      applicationCursorKeysMode: modes.applicationCursorKeysMode ?? false
    }
  }
}

describe('canClickToMove', () => {
  it('allows normal buffer without mouse / app-cursor modes', () => {
    const buffer = makeBuffer([{ isWrapped: false, cells: [cell('a')] }], 1, 0)
    expect(canClickToMove(makeTerm(buffer, 80))).toBe(true)
  })

  it('blocks alternate screen, mouse tracking and app cursor keys', () => {
    const buffer = makeBuffer([{ isWrapped: false, cells: [cell('a')] }], 1, 0, {
      type: 'alternate'
    })
    expect(canClickToMove(makeTerm(buffer, 80))).toBe(false)

    const normal = makeBuffer([{ isWrapped: false, cells: [cell('a')] }], 1, 0)
    expect(canClickToMove(makeTerm(normal, 80, { mouseTrackingMode: 'vt200' }))).toBe(false)
    expect(canClickToMove(makeTerm(normal, 80, { applicationCursorKeysMode: true }))).toBe(false)
  })
})

describe('logical line bounds', () => {
  it('walks wrapped lines', () => {
    const buffer = makeBuffer(
      [
        { isWrapped: false, cells: [cell('a'), cell('b')] },
        { isWrapped: true, cells: [cell('c'), cell('d')] },
        { isWrapped: true, cells: [cell('e')] },
        { isWrapped: false, cells: [cell('z')] }
      ],
      1,
      1
    )
    expect(getLogicalLineBounds(buffer, 1)).toEqual({ startY: 0, endY: 2 })
    expect(getLogicalLineBounds(buffer, 3)).toEqual({ startY: 3, endY: 3 })
    expect(isInLogicalLine({ startY: 0, endY: 2 }, 2)).toBe(true)
    expect(isInLogicalLine({ startY: 0, endY: 2 }, 3)).toBe(false)
  })
})

describe('char offsets and CSI', () => {
  it('counts wide characters as one movement', () => {
    const buffer = makeBuffer(
      [
        {
          isWrapped: false,
          cells: [cell('あ', 2), cell('', 0), cell('b'), ...empty(2)]
        }
      ],
      3,
      0
    )
    const bounds = getLogicalLineBounds(buffer, 0)
    expect(bufferPosToCharOffset(buffer, 5, bounds, { x: 0, y: 0 })).toBe(0)
    expect(bufferPosToCharOffset(buffer, 5, bounds, { x: 2, y: 0 })).toBe(1)
    expect(bufferPosToCharOffset(buffer, 5, bounds, { x: 3, y: 0 })).toBe(2)
    expect(charOffsetToBufferPos(buffer, 5, bounds, 1)).toEqual({ x: 2, y: 0 })
  })

  it('spans wrapped rows when computing offsets', () => {
    const buffer = makeBuffer(
      [
        { isWrapped: false, cells: [cell('a'), cell('b'), cell('c'), cell('d')] },
        { isWrapped: true, cells: [cell('e'), cell('f'), ...empty(2)] }
      ],
      2,
      1
    )
    const bounds = getLogicalLineBounds(buffer, 1)
    expect(bufferPosToCharOffset(buffer, 4, bounds, { x: 0, y: 1 })).toBe(4)
    expect(bufferPosToCharOffset(buffer, 4, bounds, { x: 2, y: 1 })).toBe(6)
    expect(getCursorBufferPos(buffer)).toEqual({ x: 2, y: 1 })
  })

  it('clamps click past content to the end of the logical line', () => {
    const buffer = makeBuffer(
      [{ isWrapped: false, cells: [cell('a'), cell('b'), cell('c'), ...empty(5)] }],
      3,
      0
    )
    const bounds = getLogicalLineBounds(buffer, 0)
    expect(getLogicalLineEndCharOffset(buffer, 8, bounds, { x: 3, y: 0 })).toBe(3)
  })

  it('builds repeated single-step arrow sequences for readline', () => {
    expect(buildCursorMoveSequence(5, 5)).toBeNull()
    expect(buildCursorMoveSequence(5, 2)).toBe('\x1b[D\x1b[D\x1b[D')
    expect(buildCursorMoveSequence(2, 7)).toBe('\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C')
  })

  it('resolves click-to-move on the current logical line only', () => {
    const buffer = makeBuffer(
      [
        { isWrapped: false, cells: [cell('h'), cell('e'), cell('l'), cell('l'), cell('o')] },
        { isWrapped: false, cells: [cell('x')] }
      ],
      5,
      0
    )
    const term = makeTerm(buffer, 5)
    expect(resolveClickToMoveSequence(term, { x: 2, y: 0 })).toBe('\x1b[D\x1b[D\x1b[D')
    expect(resolveClickToMoveSequence(term, { x: 0, y: 1 })).toBeNull()
  })
})

describe('content range and select', () => {
  it('skips a typical bash prompt when selecting content', () => {
    const prompt = 'root@host:~# '
    const cmd = 'asdafasfa'
    const line = cellsFrom(prompt + cmd).concat(empty(10))
    const cursorX = prompt.length + cmd.length
    const buffer = makeBuffer([{ isWrapped: false, cells: line }], cursorX, 0)
    const bounds = getLogicalLineBounds(buffer, 0)
    const content = getContentRange(buffer, line.length, bounds, { x: cursorX, y: 0 })
    expect(content).toEqual({ start: prompt.length, end: prompt.length + cmd.length })

    const select = vi.fn()
    const selectAll = vi.fn()
    let selection: { start: { x: number; y: number }; end: { x: number; y: number } } | undefined

    const term = {
      cols: line.length,
      buffer: { active: buffer },
      hasSelection: () => Boolean(selection),
      getSelectionPosition: () => selection,
      select: (column: number, row: number, length: number) => {
        select(column, row, length)
        selection = {
          start: { x: column, y: row },
          end: { x: column + length, y: row }
        }
      },
      selectAll: () => {
        selectAll()
        selection = { start: { x: 0, y: 0 }, end: { x: line.length, y: 0 } }
      }
    }

    selectLogicalLineOrAll(term)
    expect(select).toHaveBeenCalledWith(prompt.length, 0, cmd.length)
    expect(isContentFullySelected(term, bounds, content)).toBe(true)

    selectLogicalLineOrAll(term)
    expect(selectAll).toHaveBeenCalledOnce()
  })

  it('deletes only the selected command via backspaces', () => {
    const prompt = 'root@host:~# '
    const cmd = 'asdafasfa'
    const line = cellsFrom(prompt + cmd).concat(empty(4))
    const cursorX = prompt.length + cmd.length
    const buffer = makeBuffer([{ isWrapped: false, cells: line }], cursorX, 0)
    const term = {
      ...makeTerm(buffer, line.length),
      hasSelection: () => true,
      getSelectionPosition: () => ({
        start: { x: prompt.length, y: 0 },
        end: { x: prompt.length + cmd.length, y: 0 }
      })
    }

    const sequence = buildDeleteSelectionSequence(term)
    expect(sequence).toBe('\x7f'.repeat(cmd.length))
  })
})
