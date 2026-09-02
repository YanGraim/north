import {
  DATABASE_EXPORT_MAX_ROWS,
  DATABASE_EXPORT_PDF_MAX_ROWS,
  DATABASE_EXPORT_TIMEOUT_MS,
  DATABASE_MAX_ROWS,
  DATABASE_QUERY_TIMEOUT_MS,
  isSqlStudioEngine
} from '@shared/protocols'
import type { Access } from '@shared/types'
import type { ResolvedDatabaseConfig } from './types'

export function configFromAccess(
  access: Access,
  password: string | null | undefined
): ResolvedDatabaseConfig {
  if (access.type !== 'database' || !isSqlStudioEngine(access.engine)) {
    throw new Error('Este acesso não abre sessão SQL no North')
  }

  const filePath = access.engine === 'sqlite' ? access.host?.trim() || null : null
  if (access.engine === 'sqlite' && !filePath) {
    throw new Error('Informe o arquivo SQLite')
  }
  if (access.engine !== 'sqlite' && !access.host?.trim()) {
    throw new Error('Informe o host')
  }

  return {
    engine: access.engine,
    host: access.host,
    port: access.port,
    database: access.database,
    username: access.username,
    password: password ?? '',
    ssl: Boolean(access.ssl),
    filePath
  }
}

export function configFromTestInput(input: {
  engine: Access['engine']
  host?: string | null
  port?: number | null
  database?: string | null
  username?: string | null
  ssl?: boolean | null
  password?: string
}): ResolvedDatabaseConfig {
  if (!isSqlStudioEngine(input.engine)) {
    throw new Error('Engine não suportado no estúdio SQL')
  }
  const filePath = input.engine === 'sqlite' ? input.host?.trim() || null : null
  if (input.engine === 'sqlite' && !filePath) {
    throw new Error('Informe o arquivo SQLite')
  }
  if (input.engine !== 'sqlite' && !input.host?.trim()) {
    throw new Error('Informe o host')
  }
  return {
    engine: input.engine,
    host: input.host ?? null,
    port: input.port ?? null,
    database: input.database ?? null,
    username: input.username ?? null,
    password: input.password ?? '',
    ssl: Boolean(input.ssl),
    filePath
  }
}

export const queryLimits = {
  maxRows: DATABASE_MAX_ROWS,
  timeoutMs: DATABASE_QUERY_TIMEOUT_MS
}

export const exportQueryLimits = {
  maxRows: DATABASE_EXPORT_MAX_ROWS,
  timeoutMs: DATABASE_EXPORT_TIMEOUT_MS
}

export const exportPdfQueryLimits = {
  maxRows: DATABASE_EXPORT_PDF_MAX_ROWS,
  timeoutMs: DATABASE_EXPORT_TIMEOUT_MS
}

export function exportLimitsForFormat(format: 'pdf' | 'csv' | 'json' | 'xlsx' | 'sql'): {
  maxRows: number
  timeoutMs: number
} {
  return format === 'pdf' ? exportPdfQueryLimits : exportQueryLimits
}
