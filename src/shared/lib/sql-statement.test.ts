import { describe, expect, it } from 'vitest'
import { sqlToExecute, statementAtCursor } from './sql-statement'

const twoQueries = `SELECT * FROM users u;
SELECT * FROM users WHERE id = 1`

describe('statementAtCursor', () => {
  it('runs the statement under the cursor, not the whole buffer', () => {
    const second = twoQueries.indexOf('SELECT * FROM users WHERE')
    expect(statementAtCursor(twoQueries, second + 5)).toBe('SELECT * FROM users WHERE id = 1')
    expect(statementAtCursor(twoQueries, 0)).toBe('SELECT * FROM users u')
    expect(statementAtCursor('SELECT 1', 3)).toBe('SELECT 1')
  })

  it('ignores semicolons inside strings and comments', () => {
    const sql = "SELECT 'a;b' FROM t; SELECT 2"
    expect(statementAtCursor(sql, 0)).toBe("SELECT 'a;b' FROM t")
    expect(statementAtCursor(sql, sql.length - 1)).toBe('SELECT 2')
    expect(statementAtCursor('SELECT 1 -- ;\n; SELECT 2', 0)).toBe('SELECT 1 -- ;')
  })
})

describe('sqlToExecute', () => {
  it('prefers a non-empty selection', () => {
    expect(sqlToExecute(twoQueries, 0, 21)).toBe('SELECT * FROM users u')
    expect(sqlToExecute(twoQueries, 22, 22)).toBe('SELECT * FROM users WHERE id = 1')
  })
})
