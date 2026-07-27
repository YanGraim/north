import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv-parse'

describe('parseCsv', () => {
  it('parses headers and simple rows', () => {
    const result = parseCsv('a,b,c\n1,2,3\n4,5,6\n')
    expect(result.headers).toEqual(['a', 'b', 'c'])
    expect(result.records).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' }
    ])
  })

  it('handles quoted fields with commas and escaped quotes', () => {
    const result = parseCsv('nome,notas\n"web-01","nota, com vírgula"\n"x","diz ""oi"""\n')
    expect(result.records).toEqual([
      { nome: 'web-01', notas: 'nota, com vírgula' },
      { nome: 'x', notas: 'diz "oi"' }
    ])
  })

  it('normalizes headers to lowercase and strips BOM', () => {
    const result = parseCsv('\uFEFFTipo,Cliente\nservidor,Acme\n')
    expect(result.headers).toEqual(['tipo', 'cliente'])
    expect(result.records[0]).toEqual({ tipo: 'servidor', cliente: 'Acme' })
  })

  it('skips blank trailing lines', () => {
    const result = parseCsv('a\n1\n\n')
    expect(result.records).toHaveLength(1)
  })

  it('throws on unclosed quotes', () => {
    expect(() => parseCsv('a\n"oops\n')).toThrow(/Aspas/)
  })
})
