import { resolveEntityIcon } from '@renderer/lib/entity-icons'
import { isSqlStudioEngine } from '@shared/protocols'
import type { Access, DatabaseEngine } from '@shared/types'
import type { LucideIcon } from 'lucide-react'
import { Database, KeyRound, Link2 } from 'lucide-react'

export function accessTypeLabel(type: Access['type']): string {
  switch (type) {
    case 'database':
      return 'Banco'
    case 'login':
      return 'Login'
    case 'other':
      return 'Outro'
  }
}

export function accessTypeIcon(type: Access['type']): LucideIcon {
  switch (type) {
    case 'database':
      return Database
    case 'login':
      return KeyRound
    case 'other':
      return Link2
  }
}

export function accessDisplayIcon(access: Pick<Access, 'type' | 'icon'>): LucideIcon {
  if (access.icon) {
    return resolveEntityIcon(access.icon)
  }
  return accessTypeIcon(access.type)
}

export function engineLabel(engine: DatabaseEngine | null): string {
  if (!engine) return '—'
  switch (engine) {
    case 'postgres':
      return 'PostgreSQL'
    case 'mysql':
      return 'MySQL'
    case 'mariadb':
      return 'MariaDB'
    case 'redis':
      return 'Redis'
    case 'mongodb':
      return 'MongoDB'
    case 'mssql':
      return 'SQL Server'
    case 'sqlite':
      return 'SQLite'
    case 'other':
      return 'Outro'
  }
}

export function defaultPortForEngine(engine: DatabaseEngine): number {
  switch (engine) {
    case 'postgres':
      return 5432
    case 'mysql':
    case 'mariadb':
      return 3306
    case 'redis':
      return 6379
    case 'mongodb':
      return 27017
    case 'mssql':
      return 1433
    case 'sqlite':
      return 1
    case 'other':
      return 5432
  }
}

/** Build a connection string for copy (password optional / placeholder). */
export function buildConnectionString(access: Access, password?: string | null): string | null {
  if (access.type !== 'database' || !access.host) return null
  const engine = access.engine ?? 'other'
  const user = access.username ?? ''
  const pass = password ?? ''
  const auth =
    user || pass ? `${encodeURIComponent(user)}${pass ? `:${encodeURIComponent(pass)}` : ''}@` : ''
  const port = access.port ? `:${access.port}` : ''
  const db = access.database ? `/${encodeURIComponent(access.database)}` : ''
  const ssl = access.ssl ? '?sslmode=require' : ''

  switch (engine) {
    case 'postgres':
      return `postgresql://${auth}${access.host}${port}${db}${ssl}`
    case 'mysql':
    case 'mariadb':
      return `mysql://${auth}${access.host}${port}${db}`
    case 'mongodb':
      return `mongodb://${auth}${access.host}${port}${db}`
    case 'redis':
      return `redis://${auth}${access.host}${port}`
    case 'mssql':
      return `mssql://${auth}${access.host}${port}${db}`
    case 'sqlite':
      return `sqlite:${access.host}`
    case 'other':
      return `${auth}${access.host}${port}${db}`
  }
}

export function supportsSqlStudio(access: Pick<Access, 'type' | 'engine'>): boolean {
  return access.type === 'database' && isSqlStudioEngine(access.engine)
}

export function sqlStudioReady(access: Pick<Access, 'type' | 'engine' | 'host' | 'port'>): boolean {
  if (!supportsSqlStudio(access)) return false
  if (access.engine === 'sqlite') return Boolean(access.host?.trim())
  return Boolean(access.host?.trim() && access.port)
}
