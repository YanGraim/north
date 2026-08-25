import { keywordAt, skipTrivia, splitTopLevelStatements, walkTopLevelTokens } from './sql-scan'

function statementIsMutationWithoutWhere(sql: string): boolean {
  const i = skipTrivia(sql, 0)
  const first = keywordAt(sql, i)
  if (!first) return false
  if (first.keyword !== 'update' && first.keyword !== 'delete') return false

  let hasWhere = false
  walkTopLevelTokens(sql, (keyword) => {
    if (keyword === 'where') hasWhere = true
  })
  return !hasWhere
}

/**
 * True when any top-level UPDATE/DELETE has no WHERE at parenthesis depth 0.
 * WHERE inside subqueries does not count. String/comment literals are ignored.
 */
export function isMutationWithoutWhere(sql: string): boolean {
  const statements = splitTopLevelStatements(sql)
  if (statements.length === 0) return false
  return statements.some((span) => statementIsMutationWithoutWhere(span.text))
}
