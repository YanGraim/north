import { skipTrivia, splitTopLevelStatements } from './sql-scan'

export function sqlToExecute(sql: string, from: number, to: number): string {
  if (from !== to) {
    const selected = sql.slice(Math.min(from, to), Math.max(from, to)).trim()
    if (selected) return selected
  }
  return statementAtCursor(sql, from)
}

/**
 * Statement that contains `cursor` (0-based offset), split on top-level `;`.
 * With no semicolon, returns the whole buffer (trimmed).
 */
export function statementAtCursor(sql: string, cursor: number): string {
  const statements = splitTopLevelStatements(sql)
  if (statements.length === 0) return sql.trim()
  const pos = Math.min(Math.max(cursor, 0), sql.length)
  const match =
    statements.find((span) => pos >= span.start && pos <= span.end) ??
    statements.find((span) => pos < span.start) ??
    statements[statements.length - 1]
  return (match?.text ?? sql).trim()
}

export function firstKeywordOffset(sql: string): number {
  return skipTrivia(sql, 0)
}
