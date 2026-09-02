export {
  buildRowUpdateSql,
  isFullSqlStatement,
  previewSelectSql,
  primaryKeyLookupSql,
  qualifyRelation,
  queryResultCountSql,
  queryResultPageSql,
  quoteIdent,
  quoteLiteral,
  TABLE_BROWSE_PAGE_SIZE,
  TABLE_BROWSE_SOFT_CAP,
  tableBrowseCountSql,
  tableBrowsePageSql,
  tableBrowseSql,
  wrapCountSql
} from '@shared/lib/sql-ident'

export function pingSql(): string {
  return 'SELECT 1 AS ok'
}

export function looksLikeResultQuery(sql: string): boolean {
  const trimmed = sql
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^\/\*[\s\S]*?\*\//, '')
    .trim()
  return /^(select|with|pragma|explain|show|describe|desc|values)\b/i.test(trimmed)
}
