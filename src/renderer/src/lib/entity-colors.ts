export const ENTITY_COLORS = [
  '#3d8bfd',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#64748b',
  '#e8edf7'
] as const

export type EntityColor = (typeof ENTITY_COLORS)[number]
