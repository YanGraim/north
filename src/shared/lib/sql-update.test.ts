import { describe, expect, it } from 'vitest'
import {
  alignPrimaryKeyNames,
  buildMutationStatements,
  buildRowDeleteSql,
  buildRowInsertSql,
  buildRowUpdateSql,
  buildUpdatesFromPayloads,
  primaryKeyColumnNames,
  quoteSqlLiteral
} from './sql-update'

describe('sql update helpers', () => {
  it('quotes literals safely', () => {
    expect(quoteSqlLiteral(null)).toBe('NULL')
    expect(quoteSqlLiteral(true)).toBe('TRUE')
    expect(quoteSqlLiteral(12)).toBe('12')
    expect(quoteSqlLiteral("O'Hara")).toBe("'O''Hara'")
  })

  it('emits 1/0 for MSSQL boolean literals in UPDATE', () => {
    expect(
      buildRowUpdateSql({
        engine: 'mssql',
        schema: 'dbo',
        table: 'flags',
        pkColumns: ['id'],
        original: { id: 1, ok: true },
        changes: { ok: false }
      })
    ).toBe('UPDATE [dbo].[flags] SET [ok] = 0 WHERE [id] = 1')
  })

  it('lists primary key columns', () => {
    expect(
      primaryKeyColumnNames([
        { name: 'id', dataType: 'int', nullable: false, primaryKey: true },
        { name: 'name', dataType: 'text', nullable: true, primaryKey: false }
      ])
    ).toEqual(['id'])
  })

  it('aligns PK names to result columns without case sensitivity', () => {
    expect(alignPrimaryKeyNames(['id'], ['ID', 'Amount'])).toEqual(['ID'])
    expect(alignPrimaryKeyNames(['ID'], ['id'])).toEqual(['id'])
    expect(alignPrimaryKeyNames(['id'], [])).toEqual(['id'])
  })

  it('builds UPDATE with PK and refuses without PK', () => {
    expect(
      buildRowUpdateSql({
        engine: 'postgres',
        schema: 'public',
        table: 'users',
        pkColumns: ['id'],
        original: { id: 1, name: 'ada' },
        changes: { name: "O'Hara" }
      })
    ).toBe(`UPDATE "public"."users" SET "name" = 'O''Hara' WHERE "id" = 1`)

    expect(() =>
      buildRowUpdateSql({
        engine: 'postgres',
        schema: 'public',
        table: 'users',
        pkColumns: [],
        original: { id: 1, name: 'ada' },
        changes: { name: 'x' }
      })
    ).toThrow(/primary key/i)
  })

  it('reads PK values from the row case-insensitively', () => {
    expect(
      buildRowUpdateSql({
        engine: 'postgres',
        schema: 'public',
        table: 'balances',
        pkColumns: ['ID'],
        original: { id: 7, amount: 4 },
        changes: { amount: 4 }
      })
    ).toBe(`UPDATE "public"."balances" SET "amount" = 4 WHERE "ID" = 7`)
  })

  it('builds multiple updates from payloads', () => {
    expect(
      buildUpdatesFromPayloads(
        'mysql',
        'app',
        'orders',
        ['id'],
        [
          { original: { id: 1, sku: 'A' }, changes: { sku: 'B' } },
          { original: { id: 2, sku: 'C' }, changes: { sku: 'D' } }
        ]
      )
    ).toEqual([
      "UPDATE `app`.`orders` SET `sku` = 'B' WHERE `id` = 1",
      "UPDATE `app`.`orders` SET `sku` = 'D' WHERE `id` = 2"
    ])
  })

  it('builds DELETE and INSERT and ordered mutation batches', () => {
    expect(
      buildRowDeleteSql({
        engine: 'postgres',
        schema: 'public',
        table: 'users',
        pkColumns: ['id'],
        original: { id: 3, name: 'ada' }
      })
    ).toBe(`DELETE FROM "public"."users" WHERE "id" = 3`)

    expect(
      buildRowInsertSql({
        engine: 'postgres',
        schema: 'public',
        table: 'users',
        values: { id: null, name: "O'Hara" }
      })
    ).toBe(`INSERT INTO "public"."users" ("name") VALUES ('O''Hara')`)

    expect(
      buildMutationStatements({
        engine: 'postgres',
        schema: 'public',
        table: 'users',
        pkColumns: ['id'],
        deletes: [{ id: 1 }],
        updates: [{ original: { id: 2, name: 'a' }, changes: { name: 'b' } }],
        inserts: [{ id: null, name: 'c' }]
      })
    ).toEqual([
      `DELETE FROM "public"."users" WHERE "id" = 1`,
      `UPDATE "public"."users" SET "name" = 'b' WHERE "id" = 2`,
      `INSERT INTO "public"."users" ("name") VALUES ('c')`
    ])
  })
})
