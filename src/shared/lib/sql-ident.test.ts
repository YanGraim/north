import { describe, expect, it } from 'vitest'
import { queryResultCountSql, tableBrowseCountSql, tableExportSql, wrapCountSql } from './sql-ident'

describe('tableExportSql', () => {
  it('builds SELECT * with WHERE for postgres', () => {
    expect(tableExportSql('postgres', 'public', 'users', 'id > 1')).toBe(
      'SELECT * FROM "public"."users" WHERE id > 1'
    )
  })

  it('passes through full SQL statements', () => {
    const sql = 'SELECT id FROM public.users WHERE active = true'
    expect(tableExportSql('postgres', 'public', 'users', sql)).toBe(sql)
  })

  it('adds ORDER BY for mssql exports', () => {
    expect(tableExportSql('mssql', 'dbo', 'items', '', ['id'])).toBe(
      'SELECT * FROM [dbo].[items] ORDER BY [id]'
    )
  })

  it('quotes mysql identifiers', () => {
    expect(tableExportSql('mysql', 'app', 'orders', 'status = 1')).toBe(
      'SELECT * FROM `app`.`orders` WHERE status = 1'
    )
  })
})

describe('row count SQL', () => {
  it('counts table rows with WHERE filter', () => {
    expect(tableBrowseCountSql('postgres', 'public', 'users', 'active = true')).toBe(
      'SELECT COUNT(*) AS cnt FROM "public"."users" WHERE active = true'
    )
  })

  it('wraps full SQL in the filter bar', () => {
    const inner = 'SELECT id FROM public.users WHERE active = true'
    expect(tableBrowseCountSql('postgres', 'public', 'users', inner)).toBe(
      `SELECT COUNT(*) AS cnt FROM (${inner}) AS _north_count`
    )
  })

  it('wraps pageable queries', () => {
    const sql = 'SELECT * FROM orders WHERE status = 1'
    expect(queryResultCountSql('postgres', sql)).toBe(
      `SELECT COUNT(*) AS cnt FROM (${sql}) AS _north_count`
    )
    expect(queryResultCountSql('postgres', `${sql} LIMIT 10`)).toBeNull()
  })

  it('wrapCountSql strips trailing semicolon', () => {
    expect(wrapCountSql('postgres', 'SELECT 1;')).toBe(
      'SELECT COUNT(*) AS cnt FROM (SELECT 1) AS _north_count'
    )
  })
})
