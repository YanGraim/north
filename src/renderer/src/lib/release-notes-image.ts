import { countByKind, type ReleaseNoteKind, type ReleaseNotes } from '@shared/lib/release-notes'

/**
 * Draws release notes as a tall PNG to share in chat (WhatsApp, Teams). The
 * image leaves the app, so it uses its own fixed light palette instead of the
 * UI theme tokens: it must look the same whoever generates it.
 */
const C = {
  page: '#eef1f6',
  card: '#ffffff',
  cardLine: '#dfe4ec',
  ink: '#121a2b',
  mute: '#5d6880',
  header: '#0f2350',
  headerInk: '#ffffff',
  headerMute: '#b8c3dc',
  gold: '#f5b82e',
  chip: 'rgba(255,255,255,0.12)'
}

export const KIND_STYLE: Record<ReleaseNoteKind, { label: string; fg: string; bg: string }> = {
  new: { label: 'NOVO', fg: '#2554c7', bg: '#e6edfc' },
  improvement: { label: 'MELHORIA', fg: '#9a6400', bg: '#fdf1d6' },
  fix: { label: 'CORREÇÃO', fg: '#1d7a4e', bg: '#e1f4ea' }
}

const SANS = '"IBM Plex Sans", system-ui, sans-serif'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const font = (weight: number, size: number, mono = false) =>
  `${weight} ${size}px ${mono ? MONO : SANS}`

const WIDTH = 720
const PAD = 28
const CARD_PAD = 22
const BADGE_W = 92
const LINE = 22

type Run = { text: string; bold: boolean }

/** `**bold**` spans, the only markup the editor offers. */
export function parseRuns(text: string): Run[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false }
    )
}

/** Word-wraps runs to `maxWidth`, keeping each word's weight. */
function wrapRuns(ctx: CanvasRenderingContext2D, runs: Run[], maxWidth: number, size: number) {
  const words: Run[] = []
  for (const run of runs)
    for (const piece of run.text.split(/(\s+)/))
      if (piece) words.push({ text: piece, bold: run.bold })
  const lines: Run[][] = [[]]
  let width = 0
  for (const word of words) {
    ctx.font = font(word.bold ? 700 : 400, size)
    const w = ctx.measureText(word.text).width
    const blank = /^\s+$/.test(word.text)
    if (!blank && width + w > maxWidth && lines[lines.length - 1].length) {
      lines.push([])
      width = 0
    }
    if (blank && width === 0) continue
    lines[lines.length - 1].push(word)
    width += w
  }
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  f: string,
  color: string,
  align: CanvasTextAlign = 'left'
) {
  ctx.font = f
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(value, x, y)
}

/** Lays out and (unless `dry`) paints; returns the total height. */
function paint(ctx: CanvasRenderingContext2D, notes: ReleaseNotes, dry: boolean): number {
  ctx.textBaseline = 'alphabetic'
  const product = notes.product.trim() || 'Produto'
  const version = notes.version.trim() || 'v0.0.0'

  // header
  const headerH = 236
  if (!dry) {
    ctx.fillStyle = C.page
    ctx.fillRect(0, 0, WIDTH, 100_000)
    ctx.fillStyle = C.header
    ctx.fillRect(0, 0, WIDTH, headerH)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 34
    ctx.beginPath()
    ctx.arc(WIDTH - 40, 20, 120, 0, Math.PI * 2)
    ctx.stroke()
    text(ctx, `${product.toUpperCase()} · NOTAS DA VERSÃO`, PAD, 52, font(600, 13, true), C.gold)
    const dot = version.lastIndexOf('.')
    const head = dot > 0 ? version.slice(0, dot + 1) : version
    const tail = dot > 0 ? version.slice(dot + 1) : ''
    text(ctx, head, PAD, 124, font(700, 64), C.headerInk)
    ctx.font = font(700, 64)
    const headW = ctx.measureText(head).width
    if (tail) text(ctx, tail, PAD + headW, 124, font(700, 64), C.gold)
    const sub = [notes.date.trim(), notes.build.trim() ? `build ${notes.build.trim()}` : '']
      .filter(Boolean)
      .join(' · ')
    if (sub) text(ctx, sub, PAD, 158, font(400, 15), C.headerMute)
    const counts = countByKind(notes)
    let cx = PAD
    for (const kind of ['new', 'improvement', 'fix'] as ReleaseNoteKind[]) {
      const n = counts[kind]
      if (!n) continue
      const label = `${n} ${{ new: n === 1 ? 'novidade' : 'novidades', improvement: n === 1 ? 'melhoria' : 'melhorias', fix: n === 1 ? 'correção' : 'correções' }[kind]}`
      ctx.font = font(500, 14)
      const w = ctx.measureText(label).width + 40
      roundRect(ctx, cx, 180, w, 34, 8, C.chip)
      ctx.fillStyle = kind === 'new' ? '#7ea6ff' : kind === 'improvement' ? C.gold : '#6fd3a1'
      ctx.beginPath()
      ctx.arc(cx + 16, 197, 4, 0, Math.PI * 2)
      ctx.fill()
      text(ctx, label, cx + 28, 202, font(500, 14), C.headerInk)
      cx += w + 10
    }
  }

  let y = headerH + 24
  const textX = PAD + CARD_PAD + BADGE_W + 12
  const textW = WIDTH - textX - PAD - CARD_PAD
  for (const section of notes.sections) {
    const items = section.items.filter((i) => i.text.trim())
    if (!section.title.trim() && !items.length) continue
    const wrapped = items.map((item) => wrapRuns(ctx, parseRuns(item.text.trim()), textW, 15))
    const bodyH = wrapped.reduce((sum, lines) => sum + lines.length * LINE + 10, 0)
    const cardH = CARD_PAD + 28 + (items.length ? 14 + bodyH : 0) + CARD_PAD - 10
    if (!dry) {
      roundRect(ctx, PAD, y, WIDTH - PAD * 2, cardH, 14, C.card, C.cardLine)
      const title = section.title.trim() || 'Geral'
      text(ctx, title, PAD + CARD_PAD, y + CARD_PAD + 20, font(700, 19), C.ink)
      if (section.ticket.trim()) {
        ctx.font = font(700, 19)
        const tx = PAD + CARD_PAD + ctx.measureText(title).width + 12
        ctx.font = font(600, 12, true)
        const tw = ctx.measureText(section.ticket.trim()).width + 16
        roundRect(ctx, tx, y + CARD_PAD + 3, tw, 24, 6, KIND_STYLE.new.bg)
        text(
          ctx,
          section.ticket.trim(),
          tx + 8,
          y + CARD_PAD + 20,
          font(600, 12, true),
          KIND_STYLE.new.fg
        )
      }
      let iy = y + CARD_PAD + 28 + 14
      items.forEach((item, i) => {
        const style = KIND_STYLE[item.kind]
        roundRect(ctx, PAD + CARD_PAD, iy, BADGE_W, 22, 5, style.bg)
        text(
          ctx,
          style.label,
          PAD + CARD_PAD + BADGE_W / 2,
          iy + 15,
          font(700, 11, true),
          style.fg,
          'center'
        )
        wrapped[i].forEach((line, li) => {
          let lx = textX
          for (const word of line) {
            text(ctx, word.text, lx, iy + 16 + li * LINE, font(word.bold ? 700 : 400, 15), C.ink)
            ctx.font = font(word.bold ? 700 : 400, 15)
            lx += ctx.measureText(word.text).width
          }
        })
        iy += wrapped[i].length * LINE + 10
      })
    }
    y += cardH + 16
  }

  const footerH = 56
  if (!dry) {
    ctx.fillStyle = C.cardLine
    ctx.fillRect(0, y + 4, WIDTH, 1)
    text(ctx, product, PAD, y + 38, font(700, 14), C.ink)
    text(
      ctx,
      `Versão ${version.replace(/^v/i, '')}`,
      WIDTH - PAD,
      y + 38,
      font(400, 14),
      C.mute,
      'right'
    )
  }
  return y + footerH
}

/** Renders the notes at `scale`× for a sharp image on phones. */
export async function renderReleaseNotes(
  notes: ReleaseNotes,
  scale = 2
): Promise<HTMLCanvasElement> {
  await Promise.all([
    document.fonts.load(font(400, 15)),
    document.fonts.load(font(700, 15)),
    document.fonts.load(font(600, 12, true))
  ]).catch(() => undefined)
  const canvas = document.createElement('canvas')
  const probe = canvas.getContext('2d')
  if (!probe) throw new Error('Canvas indisponível.')
  const height = paint(probe, notes, true)
  canvas.width = WIDTH * scale
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.scale(scale, scale)
  paint(ctx, notes, false)
  return canvas
}

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))),
      'image/png'
    )
  )
}
