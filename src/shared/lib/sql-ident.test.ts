import { describe, expect, it } from 'vitest'
import { tableExportSql } from './sql-ident'

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
