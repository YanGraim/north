import { describe, expect, it } from 'vitest'
import { commitToNote, countByKind, draftReleaseNotes } from './release-notes'

const meta = { product: 'WMS', version: 'v3.5.040', date: '11/11/2026', build: '' }

describe('commitToNote', () => {
  it('maps conventional types to kinds and scope to section', () => {
    expect(commitToNote('feat(inventario): etiqueta do cliente')).toEqual({
      section: 'Inventario',
      ticket: '',
      item: { kind: 'new', text: 'Etiqueta do cliente' }
    })
    expect(commitToNote('fix: cursor fica no produto')?.item.kind).toBe('fix')
    expect(commitToNote('refactor(login): header')?.item.kind).toBe('improvement')
    expect(commitToNote('Ajusta o menu lateral')).toMatchObject({
      section: 'Geral',
      item: { kind: 'improvement', text: 'Ajusta o menu lateral' }
    })
  })

  it('lifts ticket codes out of the text, also when they are the scope', () => {
    expect(commitToNote('feat(etiquetas): WMS-247 observação chega ao servidor')).toMatchObject({
      section: 'Etiquetas',
      ticket: 'WMS-247',
      item: { text: 'Observação chega ao servidor' }
    })
    expect(commitToNote('fix(WMS-277): item já contado')).toMatchObject({
      section: 'Geral',
      ticket: 'WMS-277'
    })
  })

  it('leaves housekeeping out', () => {
    for (const m of ['chore: release 3.5.040', 'docs: readme', 'Merge branch x', 'test: y'])
      expect(commitToNote(m)).toBeNull()
  })
})

describe('draftReleaseNotes', () => {
  it('groups oldest first, dedupes and sorts kinds and sections', () => {
    const notes = draftReleaseNotes(
      [
        { hash: 'c', message: 'fix(login): https urls' },
        { hash: 'b', message: 'polish footer' },
        { hash: 'a', message: 'feat(login): new screen' },
        { hash: 'a', message: 'feat(login): new screen' }
      ],
      meta
    )
    expect(notes.sections.map((s) => s.title)).toEqual(['Login', 'Geral'])
    expect(notes.sections[0].items).toEqual([
      { kind: 'new', text: 'New screen' },
      { kind: 'fix', text: 'Https urls' }
    ])
    expect(countByKind(notes)).toEqual({ new: 1, improvement: 1, fix: 1 })
  })
})
