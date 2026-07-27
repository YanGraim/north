/**
 * Cor de status visual para ambientes (dot na árvore).
 * Heurística por nome; fallback estável por hash.
 */
const NAMED: Array<{ pattern: RegExp; color: string }> = [
  { pattern: /prod|produção|production/i, color: '#22c55e' },
  { pattern: /homolog|staging|stage|qa|hml/i, color: '#eab308' },
  { pattern: /dev|desenvolvimento|local|sandbox/i, color: '#3d8bfd' }
]

const FALLBACK = ['#22c55e', '#eab308', '#3d8bfd', '#a855f7', '#f97316', '#14b8a6'] as const

export function environmentStatusColor(name: string): string {
  for (const entry of NAMED) {
    if (entry.pattern.test(name)) return entry.color
  }

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return FALLBACK[hash % FALLBACK.length]
}
