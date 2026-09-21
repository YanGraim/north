import { describe, expect, it } from 'vitest'
import { stripJsonComments } from './jsonc'

describe('stripJsonComments', () => {
  it('leaves plain JSON untouched', () => {
    const json = '{"a":1,"b":"x"}'
    expect(JSON.parse(stripJsonComments(json))).toEqual({ a: 1, b: 'x' })
  })

  it('strips // line comments', () => {
    const jsonc = `{
      // this is the id
      "id": 1
    }`
    expect(JSON.parse(stripJsonComments(jsonc))).toEqual({ id: 1 })
  })

  it('strips /* */ block comments, including multi-line', () => {
    const jsonc = `{
      /* explains
         the field */
      "id": 1
    }`
    expect(JSON.parse(stripJsonComments(jsonc))).toEqual({ id: 1 })
  })

  it('does not strip // or /* */ inside string values', () => {
    const jsonc = `{"url": "https://example.com/a/*b*", "note": "a // not a comment"}`
    expect(JSON.parse(stripJsonComments(jsonc))).toEqual({
      url: 'https://example.com/a/*b*',
      note: 'a // not a comment'
    })
  })

  it('handles escaped quotes inside strings without breaking string detection', () => {
    const jsonc = `{"note": "she said \\"// not a comment\\""}`
    expect(JSON.parse(stripJsonComments(jsonc))).toEqual({ note: 'she said "// not a comment"' })
  })
})
