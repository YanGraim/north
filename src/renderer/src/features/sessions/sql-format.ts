import type { SqlStudioEngine } from '@shared/protocols'
import { format, type SqlLanguage } from 'sql-formatter'

export function sqlFormatterLanguage(engine: SqlStudioEngine): SqlLanguage {
  switch (engine) {
    case 'postgres':
      return 'postgresql'
    case 'mysql':
      return 'mysql'
    case 'mariadb':
      return 'mariadb'
    case 'mssql':
      return 'transactsql'
    case 'sqlite':
      return 'sqlite'
  }
}

/** Pretty-print SQL for the studio editor. Keywords uppercased; identifiers preserved. */
export function formatStudioSql(engine: SqlStudioEngine, sql: string): string {
  if (sql.trim().length === 0) return sql
  try {
    return format(sql, {
      language: sqlFormatterLanguage(engine),
      tabWidth: 2,
      keywordCase: 'upper',
      identifierCase: 'preserve'
    })
  } catch {
    return sql
  }
}
