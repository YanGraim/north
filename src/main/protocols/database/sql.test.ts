import { describe, expect, it } from 'vitest'
import {
  buildRowUpdateSql,
  isFullSqlStatement,
  previewSelectSql,
  primaryKeyLookupSql,
  qualifyRelation,
  queryResultPageSql,
  quoteIdent,
  quoteLiteral,
  TABLE_BROWSE_PAGE_SIZE,
  tableBrowsePageSql,
  tableBrowseSql
} from './sql'

describe('sql helpers', () => {
  it('quotes identifiers per engine', () => {
    expect(quoteIdent('postgres', 'foo"bar')).toBe('"foo""bar"')
    expect(quoteIdent('mysql', 'foo`bar')).toBe('`foo``bar`')
    expect(quoteIdent('mssql', 'foo]bar')).toBe('[foo]]bar]')
  })

  it('quotes literals safely', () => {
    expect(quoteLiteral('postgres', "O'Brien")).toBe("'O''Brien'")
    expect(quoteLiteral('postgres', null)).toBe('NULL')
    expect(quoteLiteral('postgres', true)).toBe('TRUE')
    expect(quoteLiteral('mysql', false)).toBe('0')
  })

  it('builds UPDATE with primary key and refuses without one', () => {
    expect(
      buildRowUpdateSql('postgres', 'public', 'users', ['id'], { id: 1, name: 'a' }, { name: 'b' })
    ).toBe('UPDATE "public"."users" SET "name" = \'b\' WHERE "id" = 1')
    expect(() =>
      buildRowUpdateSql('postgres', 'public', 'users', [], { id: 1 }, { name: 'b' })
    ).toThrow(/primary key/i)
  })

  it('builds preview selects', () => {
    expect(previewSelectSql('postgres', 'public', 'users')).toBe(
      `SELECT * FROM "public"."users" LIMIT ${TABLE_BROWSE_PAGE_SIZE} OFFSET 0`
    )
    expect(previewSelectSql('mssql', 'dbo', 'users')).toBe(
      `SELECT * FROM [dbo].[users] ORDER BY 1 OFFSET 0 ROWS FETCH NEXT ${TABLE_BROWSE_PAGE_SIZE} ROWS ONLY`
    )
    expect(previewSelectSql('sqlite', 'main', 'users')).toBe(
      `SELECT * FROM "users" LIMIT ${TABLE_BROWSE_PAGE_SIZE} OFFSET 0`
    )
  })

  it('qualifies sqlite main schema as bare table', () => {
    expect(qualifyRelation('sqlite', 'main', 't')).toBe('"t"')
  })

  it('wraps a WHERE filter and passes full SQL through', () => {
    expect(isFullSqlStatement('id = 1')).toBe(false)
    expect(isFullSqlStatement('SELECT 1')).toBe(true)
    expect(tableBrowseSql('postgres', 'public', 'users', 'id = 1')).toBe(
      `SELECT * FROM "public"."users" WHERE id = 1 LIMIT ${TABLE_BROWSE_PAGE_SIZE} OFFSET 0`
    )
    expect(tableBrowseSql('mssql', 'dbo', 'users', 'id = 1')).toBe(
      `SELECT * FROM [dbo].[users] WHERE id = 1 ORDER BY 1 OFFSET 0 ROWS FETCH NEXT ${TABLE_BROWSE_PAGE_SIZE} ROWS ONLY`
    )
    expect(tableBrowseSql('postgres', 'public', 'users', 'SELECT 1')).toBe('SELECT 1')
    expect(tableBrowseSql('postgres', 'public', 'users', 'WHERE id = 1')).toBe(
      `SELECT * FROM "public"."users" WHERE id = 1 LIMIT ${TABLE_BROWSE_PAGE_SIZE} OFFSET 0`
    )
  })

  it('builds paged browse SQL with offset and optional ORDER BY', () => {
    expect(TABLE_BROWSE_PAGE_SIZE).toBe(100)
    expect(
      tableBrowsePageSql('postgres', 'public', 'orders', '', 100, TABLE_BROWSE_PAGE_SIZE, ['id'])
    ).toBe(`SELECT * FROM "public"."orders" LIMIT ${TABLE_BROWSE_PAGE_SIZE} OFFSET 100`)
    expect(
      tableBrowsePageSql('mssql', 'dbo', 'orders', 'status = 1', 200, TABLE_BROWSE_PAGE_SIZE, [
        'id',
        'sku'
      ])
    ).toBe(
      `SELECT * FROM [dbo].[orders] WHERE status = 1 ORDER BY [id], [sku] OFFSET 200 ROWS FETCH NEXT ${TABLE_BROWSE_PAGE_SIZE} ROWS ONLY`
    )
    expect(tableBrowsePageSql('mysql', null, 't', 'SELECT * FROM t', 0, 200)).toBe(
      'SELECT * FROM t'
    )
  })

  it('builds primary-key lookup SQL per engine', () => {
    expect(primaryKeyLookupSql('postgres', 'public', 'balances')).toContain('indisprimary')
    expect(primaryKeyLookupSql('postgres', 'public', 'balances')).toContain("'balances'")
    expect(primaryKeyLookupSql('mysql', 'app', 'orders')).toContain("constraint_name = 'PRIMARY'")
    expect(primaryKeyLookupSql('mssql', 'dbo', 'orders')).toContain('is_primary_key = 1')
    expect(primaryKeyLookupSql('sqlite', 'main', 'users')).toContain('pragma_table_info')
  })

  it('pages a Query-tab SELECT without wrapping in a subquery', () => {
    expect(queryResultPageSql('postgres', 'SELECT * FROM users ORDER BY id', 0, 100)).toBe(
      'SELECT * FROM users ORDER BY id LIMIT 100 OFFSET 0'
    )
    expect(queryResultPageSql('postgres', 'SELECT * FROM users LIMIT 10', 0, 100)).toBeNull()
    expect(queryResultPageSql('postgres', 'SELECT 1; SELECT 2', 0, 100)).toBeNull()
    expect(queryResultPageSql('mssql', 'SELECT * FROM users ORDER BY id', 100, 100)).toBe(
      'SELECT * FROM users ORDER BY id OFFSET 100 ROWS FETCH NEXT 100 ROWS ONLY'
    )
    expect(queryResultPageSql('mssql', 'SELECT * FROM users', 0, 100)).toBe(
      'SELECT * FROM users ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY'
    )
    expect(queryResultPageSql('mssql', 'SELECT TOP 10 * FROM users', 0, 100)).toBeNull()
  })
})
