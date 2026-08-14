import { describe, expect, it } from 'vitest'
import { formatStudioSql, sqlFormatterLanguage } from './sql-format'

describe('sqlFormatterLanguage', () => {
  it('maps studio engines to sql-formatter dialects', () => {
    expect(sqlFormatterLanguage('postgres')).toBe('postgresql')
    expect(sqlFormatterLanguage('mysql')).toBe('mysql')
    expect(sqlFormatterLanguage('mariadb')).toBe('mariadb')
    expect(sqlFormatterLanguage('mssql')).toBe('transactsql')
    expect(sqlFormatterLanguage('sqlite')).toBe('sqlite')
  })
})

describe('formatStudioSql', () => {
  it('uppercases keywords and breaks clauses', () => {
    const formatted = formatStudioSql(
      'postgres',
      `SELECT * from users u
WHERE u."NOME" = 'Yan Pinheiro'`
    )
    expect(formatted).toContain('SELECT')
    expect(formatted).toContain('FROM')
    expect(formatted).toContain('WHERE')
    expect(formatted).toContain('u."NOME"')
    expect(formatted).toContain("'Yan Pinheiro'")
    expect(formatted).not.toMatch(/\bfrom\b/)
    expect(formatted.split('\n').length).toBeGreaterThan(1)
  })

  it('returns empty / whitespace-only input unchanged', () => {
    expect(formatStudioSql('postgres', '')).toBe('')
    expect(formatStudioSql('postgres', '   ')).toBe('   ')
  })
})
