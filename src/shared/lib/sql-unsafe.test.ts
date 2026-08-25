import { describe, expect, it } from 'vitest'
import { isMutationWithoutWhere } from './sql-unsafe'

describe('isMutationWithoutWhere', () => {
  it('flags top-level UPDATE/DELETE without WHERE', () => {
    expect(isMutationWithoutWhere('UPDATE users SET name = 1')).toBe(true)
    expect(isMutationWithoutWhere('DELETE FROM users')).toBe(true)
    expect(isMutationWithoutWhere('delete from users;')).toBe(true)
  })

  it('allows WHERE at depth 0 and ignores subquery WHERE', () => {
    expect(isMutationWithoutWhere('UPDATE users SET name = 1 WHERE id = 1')).toBe(false)
    expect(isMutationWithoutWhere('DELETE FROM users WHERE id = 1')).toBe(false)
    expect(
      isMutationWithoutWhere('UPDATE users SET name = (SELECT name FROM other WHERE id = 1)')
    ).toBe(true)
    expect(isMutationWithoutWhere("UPDATE users SET name = 'where x' WHERE id = 1")).toBe(false)
  })

  it('ignores comments and flags any dangerous statement in a batch', () => {
    expect(isMutationWithoutWhere('-- UPDATE users SET x = 1\nSELECT 1')).toBe(false)
    expect(isMutationWithoutWhere('UPDATE users SET x = 1 -- WHERE id = 1')).toBe(true)
    expect(isMutationWithoutWhere('SELECT 1; DELETE FROM t')).toBe(true)
    expect(isMutationWithoutWhere('SELECT 1; UPDATE t SET x = 1 WHERE id = 1')).toBe(false)
  })

  it('does not flag SELECT or INSERT', () => {
    expect(isMutationWithoutWhere('SELECT * FROM users')).toBe(false)
    expect(isMutationWithoutWhere("INSERT INTO users (name) VALUES ('a')")).toBe(false)
  })
})
