/**
 * Cor e tipo visual de ambientes.
 * Preferência: cor salva no ambiente; fallback por heurística de nome.
 */
export type EnvironmentKind = 'production' | 'staging' | 'development' | 'other'

const RULES: Array<{ kind: EnvironmentKind; pattern: RegExp; color: string }> = [
  { kind: 'production', pattern: /prod|produção|production/i, color: '#ef4444' },
  { kind: 'staging', pattern: /homolog|staging|stage|qa|hml/i, color: '#eab308' },
  { kind: 'development', pattern: /dev|desenvolvimento|local|sandbox/i, color: '#3d8bfd' }
]

const FALLBACK = ['#22c55e', '#eab308', '#3d8bfd', '#a855f7', '#f97316', '#14b8a6'] as const

export type EnvironmentVisual = {
  name: string
  color: string | null | undefined
}

export function environmentKind(name: string): EnvironmentKind {
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.kind
  }
  return 'other'
}

export function isProductionEnvironment(name: string): boolean {
  return environmentKind(name) === 'production'
}

/** Ambientes com destaque contextual (banner / aba). */
export function hasEnvironmentContext(name: string): boolean {
  return environmentKind(name) !== 'other'
}

export function defaultEnvironmentColor(name: string): string {
  const matched = RULES.find((rule) => rule.pattern.test(name))
  if (matched) return matched.color

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return FALLBACK[hash % FALLBACK.length]
}

export function environmentStatusColor(name: string, color?: string | null): string {
  if (color?.trim()) return color.trim()
  return defaultEnvironmentColor(name)
}

export function environmentBadgeLabel(name: string): string {
  switch (environmentKind(name)) {
    case 'production':
      return 'PROD'
    case 'staging':
      return 'HML'
    case 'development':
      return 'DEV'
    default:
      return name
  }
}

export function environmentContextMessage(name: string): string {
  switch (environmentKind(name)) {
    case 'production':
      return 'Ambiente live — confira duas vezes antes de alterar dados ou reiniciar serviços.'
    case 'staging':
      return 'Ambiente de homologação — mudanças podem afetar testes e validações.'
    case 'development':
      return 'Ambiente de desenvolvimento — seguro para experimentos e debug.'
    default:
      return 'Ambiente selecionado.'
  }
}
