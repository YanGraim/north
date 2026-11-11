import type { EnvironmentUpdateCommit } from '../types/environment-update'

export type ReleaseNoteKind = 'new' | 'improvement' | 'fix'

export type ReleaseNoteItem = { kind: ReleaseNoteKind; text: string }

export type ReleaseNoteSection = {
  title: string
  /** Ticket code shown beside the title (e.g. WMS-277); empty when none. */
  ticket: string
  items: ReleaseNoteItem[]
}

export type ReleaseNotes = {
  product: string
  version: string
  date: string
  build: string
  sections: ReleaseNoteSection[]
}

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/
const TICKET = /\b[A-Z][A-Z0-9]+-\d+\b/
/** Housekeeping commits that never reach the people who use the product. */
const SKIPPED_TYPES = new Set(['chore', 'docs', 'test', 'tests', 'ci', 'build', 'release', 'style'])
const KIND_BY_TYPE: Record<string, ReleaseNoteKind> = { feat: 'new', fix: 'fix', hotfix: 'fix' }
export const GENERAL_SECTION = 'Geral'

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function sectionTitle(scope: string | undefined): string {
  if (!scope) return GENERAL_SECTION
  return capitalize(scope.replace(/[-_]+/g, ' ').trim())
}

/** One commit as a release-note line, or null when it should stay out. */
export function commitToNote(
  message: string
): { section: string; ticket: string; item: ReleaseNoteItem } | null {
  const first = message.split('\n')[0].trim()
  if (!first || /^(merge|revert)\b/i.test(first)) return null
  const ticket = first.match(TICKET)?.[0] ?? ''
  const match = first.match(CONVENTIONAL)
  const type = match?.[1].toLowerCase()
  if (type && SKIPPED_TYPES.has(type)) return null
  const scope = match?.[2]
  const raw = match ? match[4] : first
  const text = capitalize(
    raw
      .replace(TICKET, '')
      .replace(/^[\s:–-]+|[\s:–-]+$/g, '')
      .replace(/\s{2,}/g, ' ')
  )
  if (!text) return null
  return {
    section: sectionTitle(scope && !TICKET.test(scope) ? scope : undefined),
    ticket,
    item: { kind: (type && KIND_BY_TYPE[type]) || 'improvement', text }
  }
}

/**
 * First draft of the release notes for one or more updates: commits grouped by
 * Conventional Commit scope (feat → new, fix → fix, the rest → improvement),
 * ticket codes lifted to the section, housekeeping and duplicate commits left
 * out. The person edits the result before generating the image.
 */
export function draftReleaseNotes(
  commits: EnvironmentUpdateCommit[],
  meta: Omit<ReleaseNotes, 'sections'>
): ReleaseNotes {
  const seen = new Set<string>()
  const sections = new Map<string, ReleaseNoteSection>()
  // git log lists newest first; notes read better oldest first
  for (const commit of [...commits].reverse()) {
    if (seen.has(commit.hash)) continue
    seen.add(commit.hash)
    const note = commitToNote(commit.message)
    if (!note) continue
    const section = sections.get(note.section) ?? { title: note.section, ticket: '', items: [] }
    if (!section.ticket && note.ticket) section.ticket = note.ticket
    if (!section.items.some((i) => i.text === note.item.text)) section.items.push(note.item)
    sections.set(note.section, section)
  }
  const order: ReleaseNoteKind[] = ['new', 'improvement', 'fix']
  const list = [...sections.values()].map((s) => ({
    ...s,
    items: [...s.items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
  }))
  // "Geral" goes last: scoped sections say more
  list.sort((a, b) => Number(a.title === GENERAL_SECTION) - Number(b.title === GENERAL_SECTION))
  return { ...meta, sections: list }
}

export function countByKind(notes: ReleaseNotes): Record<ReleaseNoteKind, number> {
  const counts: Record<ReleaseNoteKind, number> = { new: 0, improvement: 0, fix: 0 }
  for (const section of notes.sections) for (const item of section.items) counts[item.kind]++
  return counts
}
