import type { ResolvedTheme } from '@renderer/stores/ui-store'
import type { DatabaseEngine } from '@shared/types'

/** Engines with a vendored Simple Icons mark (CC0). */
export type BrandEngine = Exclude<DatabaseEngine, 'other'>

const BRAND_ENGINES = new Set<BrandEngine>([
  'postgres',
  'mysql',
  'mariadb',
  'redis',
  'mongodb',
  'mssql',
  'sqlite'
])

export function isBrandEngine(engine: DatabaseEngine | null | undefined): engine is BrandEngine {
  return engine != null && engine !== 'other' && BRAND_ENGINES.has(engine as BrandEngine)
}

export function resolveEngineBrand(engine: DatabaseEngine | null | undefined): BrandEngine | null {
  return isBrandEngine(engine) ? engine : null
}

/**
 * Any saved Lucide icon (including the cylinder) wins over the engine brand.
 * `null` means “use the default”: brand for known engines, else type/protocol icon.
 */
export function usesCustomInventoryIcon(icon: string | null | undefined): boolean {
  return Boolean(icon)
}

const BRAND_COLORS: Record<BrandEngine, { light: string; dark: string }> = {
  postgres: { light: '#4169E1', dark: '#5B8DEF' },
  mysql: { light: '#4479A1', dark: '#5E9BC4' },
  mariadb: { light: '#003545', dark: '#0AA5C0' },
  redis: { light: '#DC382D', dark: '#EF6359' },
  mongodb: { light: '#47A248', dark: '#5CBD5E' },
  mssql: { light: '#CC2927', dark: '#E34B48' },
  sqlite: { light: '#003B57', dark: '#0F80CC' }
}

export function brandColorForEngine(engine: BrandEngine, theme: ResolvedTheme = 'dark'): string {
  const colors = BRAND_COLORS[engine]
  return theme === 'light' ? colors.light : colors.dark
}
