import { describe, expect, it } from 'vitest'
import type { DatabaseIntrospection } from '../protocols/database'
import {
  analyzeUpdatableSql,
  filterChangesToTableColumns,
  parsePrimaryFromRelation,
  resolveUpdatableTarget
} from './sql-updatable-query'

const tree: DatabaseIntrospection = {
  schemas: [
    {
      name: 'public',
      tables: [
        {
          name: 'balances',
          type: 'table',
          columns: [
            { name: 'id', dataType: 'int', nullable: false, primaryKey: true },
            { name: 'amount', dataType: 'numeric', nullable: true, primaryKey: false },
            { name: 'user_id', dataType: 'int', nullable: true, primaryKey: false }
          ]
        },
        {
          name: 'users',
          type: 'table',
          columns: [
            { name: 'id', dataType: 'int', nullable: false, primaryKey: true },
            { name: 'name', dataType: 'text', nullable: true, primaryKey: false }
          ]
        },
        {
          name: 'v_balances',
          type: 'view',
          columns: [{ name: 'id', dataType: 'int', nullable: false, primaryKey: false }]
        }
      ]
    }
  ]
}

describe('parsePrimaryFromRelation', () => {
  it('reads FROM table alias and qualified names', () => {
    expect(parsePrimaryFromRelation('SELECT ID, Amount FROM balances b WHERE ID = 4')).toEqual({
      schema: null,
      table: 'balances'
    })
    expect(parsePrimaryFromRelation('SELECT * FROM public.balances')).toEqual({
      schema: 'public',
      table: 'balances'
    })
    expect(parsePrimaryFromRelation('select * from "My Schema"."My Table" t')).toEqual({
      schema: 'My Schema',
      table: 'My Table'
    })
    expect(parsePrimaryFromRelation('SELECT a FROM `app`.`orders` AS o')).toEqual({
      schema: 'app',
      table: 'orders'
    })
    expect(parsePrimaryFromRelation('SELECT a FROM [dbo].[items]')).toEqual({
      schema: 'dbo',
      table: 'items'
    })
  })

  it('uses the main FROM table when the query has JOINs', () => {
    expect(
      parsePrimaryFromRelation(
        'SELECT b.ID, u.name FROM balances b JOIN users u ON u.id = b.user_id'
      )
    ).toEqual({ schema: null, table: 'balances' })
    expect(
      parsePrimaryFromRelation('SELECT * FROM balances b LEFT JOIN users u ON u.id = b.user_id')
    ).toEqual({ schema: null, table: 'balances' })
  })

  it('ignores FROM inside strings, comments and subqueries in the select list', () => {
    expect(parsePrimaryFromRelation("SELECT 'from x' FROM balances")).toEqual({
      schema: null,
      table: 'balances'
    })
    expect(parsePrimaryFromRelation('SELECT 1 FROM balances -- FROM users')).toEqual({
      schema: null,
      table: 'balances'
    })
    expect(
      parsePrimaryFromRelation('SELECT (SELECT name FROM users WHERE id = 1) FROM balances')
    ).toEqual({ schema: null, table: 'balances' })
  })
})

describe('analyzeUpdatableSql', () => {
  it('refuses DISTINCT, GROUP BY, UNION/EXCEPT/INTERSECT and WITH', () => {
    expect(analyzeUpdatableSql('SELECT DISTINCT id FROM balances')).toEqual({
      kind: 'blocked',
      reason: 'distinct'
    })
    expect(analyzeUpdatableSql('SELECT id FROM balances GROUP BY id')).toEqual({
      kind: 'blocked',
      reason: 'group-by'
    })
    expect(analyzeUpdatableSql('SELECT id FROM balances UNION SELECT id FROM users')).toEqual({
      kind: 'blocked',
      reason: 'set-op'
    })
    expect(analyzeUpdatableSql('WITH x AS (SELECT * FROM balances) SELECT * FROM x')).toEqual({
      kind: 'blocked',
      reason: 'cte'
    })
  })

  it('refuses non-SELECT, missing FROM and subquery FROM', () => {
    expect(analyzeUpdatableSql('INSERT INTO balances (amount) VALUES (1)')).toEqual({
      kind: 'blocked',
      reason: 'not-select'
    })
    expect(analyzeUpdatableSql('SELECT 1')).toEqual({ kind: 'blocked', reason: 'no-from' })
    expect(analyzeUpdatableSql('SELECT * FROM (SELECT * FROM balances) x')).toEqual({
      kind: 'blocked',
      reason: 'subquery-from'
    })
  })

  it('allows ORDER BY / LIMIT and GROUP BY only inside a subquery', () => {
    expect(analyzeUpdatableSql('SELECT * FROM balances ORDER BY id LIMIT 10').kind).toBe('ok')
    expect(
      analyzeUpdatableSql(
        'SELECT * FROM balances WHERE id IN (SELECT user_id FROM users GROUP BY user_id)'
      ).kind
    ).toBe('ok')
  })

  it('parses T-SQL TOP, bracket names and table hints', () => {
    expect(analyzeUpdatableSql('SELECT TOP 10 * FROM [dbo].[items]').kind).toBe('ok')
    expect(analyzeUpdatableSql('SELECT TOP (10) * FROM [dbo].[items]').kind).toBe('ok')
    expect(analyzeUpdatableSql('SELECT * FROM [dbo].[items] WITH (NOLOCK)').kind).toBe('ok')
    expect(parsePrimaryFromRelation('SELECT TOP 5 id FROM [dbo].[items]')).toEqual({
      schema: 'dbo',
      table: 'items'
    })
  })
})

describe('resolveUpdatableTarget', () => {
  it('resolves a free query to the FROM table and aligns PK to the result set', () => {
    expect(
      resolveUpdatableTarget(
        { kind: 'query', sql: 'SELECT ID, Amount FROM balances b WHERE ID = 4' },
        { tree, resultColumnNames: ['ID', 'Amount'] }
      )
    ).toEqual({
      ok: true,
      target: {
        schema: 'public',
        table: 'balances',
        pkColumns: ['ID'],
        tableColumnNames: ['id', 'amount', 'user_id']
      }
    })
  })

  it('uses the table-tab schema/table without parsing SQL', () => {
    expect(
      resolveUpdatableTarget(
        { kind: 'table', schema: 'public', table: 'balances' },
        { tree, resultColumnNames: ['id', 'amount'] }
      )
    ).toMatchObject({
      ok: true,
      target: { schema: 'public', table: 'balances', pkColumns: ['id'] }
    })
  })

  it('refuses views, missing PK and PK absent from the result', () => {
    expect(
      resolveUpdatableTarget(
        { kind: 'table', schema: 'public', table: 'v_balances' },
        { tree, resultColumnNames: ['id'] }
      )
    ).toEqual({ ok: false, reason: 'view' })

    expect(
      resolveUpdatableTarget(
        { kind: 'query', sql: 'SELECT amount FROM balances' },
        { tree, resultColumnNames: ['amount'] }
      )
    ).toEqual({ ok: false, reason: 'pk-not-in-result' })

    expect(
      resolveUpdatableTarget(
        { kind: 'query', sql: 'SELECT * FROM unknown_table' },
        { tree, resultColumnNames: ['id'] }
      )
    ).toEqual({ ok: false, reason: 'no-pk' })
  })

  it('uses a PK override when introspection missed it', () => {
    expect(
      resolveUpdatableTarget(
        { kind: 'query', sql: 'SELECT ID FROM unknown_table' },
        { tree, resultColumnNames: ['ID'], pkOverride: ['id'] }
      )
    ).toMatchObject({
      ok: true,
      target: { table: 'unknown_table', pkColumns: ['ID'] }
    })
  })
})

describe('filterChangesToTableColumns', () => {
  it('keeps only columns that exist on the FROM table', () => {
    expect(
      filterChangesToTableColumns({ amount: 4, name: 'ada', Amount: 9 }, [
        'id',
        'amount',
        'user_id'
      ])
    ).toEqual({ amount: 4, Amount: 9 })
  })

  it('keeps every change when the table columns are unknown', () => {
    expect(filterChangesToTableColumns({ amount: 1 }, [])).toEqual({ amount: 1 })
  })
})
