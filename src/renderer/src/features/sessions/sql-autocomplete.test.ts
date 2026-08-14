import { describe, expect, it } from 'vitest'
import {
  aliasBase,
  buildSqlConfig,
  buildSqlSchema,
  formatIdent,
  identAt,
  isRelationCompletionContext,
  listFilterCompletions,
  listTableNames,
  planTableAliasExpand,
  scoreObjectMatch,
  tableNeedsAlias,
  uniqueAlias
} from './sql-autocomplete'

const sampleTree = {
  schemas: [
    {
      name: 'public',
      tables: [
        {
          name: 'balances',
          type: 'table' as const,
          columns: [
            { name: 'id', dataType: 'uuid', nullable: false, primaryKey: true },
            { name: 'amount', dataType: 'numeric', nullable: false, primaryKey: false }
          ]
        },
        {
          name: 'api_version',
          type: 'table' as const,
          columns: [{ name: 'code', dataType: 'text', nullable: false, primaryKey: true }]
        },
        {
          name: 'weird-name',
          type: 'table' as const,
          columns: [{ name: 'x', dataType: 'int', nullable: true, primaryKey: false }]
        }
      ]
    }
  ]
}

describe('sql-autocomplete', () => {
  it('treats FROM / JOIN / INTO as table-completion context', () => {
    expect(isRelationCompletionContext('SELECT * FROM us', 16)).toBe(true)
    expect(isRelationCompletionContext('SELECT * FROM ', 14)).toBe(true)
    expect(isRelationCompletionContext('SELECT * FROM users JOIN us', 27)).toBe(true)
    expect(isRelationCompletionContext('INSERT INTO us', 14)).toBe(true)
    expect(isRelationCompletionContext('UPDATE us', 9)).toBe(true)
    expect(isRelationCompletionContext('SELECT us', 9)).toBe(false)
    expect(isRelationCompletionContext('SELECT * FROM users WHERE us', 28)).toBe(false)
  })

  it('ranks table names like DBeaver (prefix, substring, token)', () => {
    expect(scoreObjectMatch('users', 'users')).toBe(100)
    expect(scoreObjectMatch('users_companies', 'users')).toBe(80)
    expect(scoreObjectMatch('log_users', 'users')).toBe(60)
    expect(scoreObjectMatch('columns_users', 'users')).toBe(60)
    expect(scoreObjectMatch('user_sessions', 'users')).toBe(30)
    expect(scoreObjectMatch('warehouses', 'users')).toBeNull()
  })

  it('builds alias initials from snake/kebab segments', () => {
    expect(aliasBase('balances')).toBe('b')
    expect(aliasBase('api_version')).toBe('av')
    expect(aliasBase('order-items')).toBe('oi')
  })

  it('avoids colliding aliases already present in the buffer', () => {
    expect(uniqueAlias('balances', 'SELECT * FROM other b')).toBe('b2')
    expect(uniqueAlias('balances', 'SELECT * FROM other b JOIN x b2')).toBe('b3')
    expect(uniqueAlias('balances', 'SELECT 1')).toBe('b')
  })

  it('quotes identifiers only when needed', () => {
    expect(formatIdent('postgres', 'balances')).toBe('balances')
    expect(formatIdent('postgres', 'NOME')).toBe('"NOME"')
    expect(formatIdent('postgres', 'weird-name')).toBe('"weird-name"')
    expect(formatIdent('mysql', 'NOME')).toBe('NOME')
    expect(formatIdent('mysql', 'weird-name')).toBe('`weird-name`')
    expect(formatIdent('mssql', 'weird-name')).toBe('[weird-name]')
  })

  it('restricts filter completions to columns and WHERE keywords', () => {
    const options = listFilterCompletions('postgres', ['NOME', 'COD_ESTADO', 'ID'], 'n')
    expect(options.map((item) => item.label)).toEqual(['NOME', 'NOT', 'NULL'])
    expect(options.find((item) => item.label === 'NOME')?.apply).toBe('"NOME"')
  })

  it('matches filter columns by substring, not only prefix', () => {
    const options = listFilterCompletions('postgres', ['COD_ESTADO', 'NOME'], 'estado')
    expect(options.map((item) => item.label)).toContain('COD_ESTADO')
  })

  it('does not suggest other tables in the filter bar', () => {
    const options = listFilterCompletions('postgres', ['amount'], 'a')
    expect(options.every((item) => item.detail === 'column' || item.detail === 'keyword')).toBe(
      true
    )
    expect(options.map((item) => item.label)).toEqual(['amount', 'AND'])
  })

  it('maps introspection to SQLConfig schema with table completions', () => {
    const schema = buildSqlSchema('postgres', sampleTree) as Record<string, unknown>
    const publicSchema = schema.public as Record<
      string,
      { self: { label: string; detail?: string; aliasPreview?: string }; children: string[] }
    >
    expect(publicSchema.balances.self.label).toBe('balances')
    expect(publicSchema.balances.self.detail).toBe('Table')
    expect(publicSchema.balances.self.aliasPreview).toBe('b')
    expect(publicSchema.balances.children).toEqual(['id', 'amount'])
    expect(listTableNames(sampleTree)).toEqual(['balances', 'api_version', 'weird-name'])

    const config = buildSqlConfig('postgres', sampleTree)
    expect(config.defaultSchema).toBe('public')
    expect(config.dialect).toBeTruthy()
  })

  it('detects identifiers and whether a table still needs an alias', () => {
    const sql = 'SELECT * FROM balances'
    expect(identAt(sql, sql.length)?.text).toBe('balances')
    expect(tableNeedsAlias(sql, sql.length)).toBe(true)
    expect(tableNeedsAlias('SELECT * FROM balances b', 'SELECT * FROM balances'.length)).toBe(false)
    expect(tableNeedsAlias('SELECT * FROM balances WHERE', 'SELECT * FROM balances'.length)).toBe(
      true
    )
  })

  it('plans Tab expand for a bare table name with a unique alias', () => {
    const doc = 'SELECT * FROM balances'
    const plan = planTableAliasExpand(doc, doc.length, 'postgres', new Set(['balances']))
    expect(plan).toEqual({
      from: 'SELECT * FROM '.length,
      to: doc.length,
      insert: 'balances b'
    })
  })

  it('does not plan expand when an alias is already present', () => {
    const doc = 'SELECT * FROM balances b'
    expect(
      planTableAliasExpand(doc, 'SELECT * FROM balances'.length, 'postgres', new Set(['balances']))
    ).toBeNull()
  })

  it('picks b2 when expanding and b is already used', () => {
    const doc = 'SELECT b.id FROM other b JOIN balances'
    const plan = planTableAliasExpand(doc, doc.length, 'postgres', new Set(['balances']))
    expect(plan?.insert).toBe('balances b2')
  })
})
