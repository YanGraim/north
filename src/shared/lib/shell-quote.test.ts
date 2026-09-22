import { describe, expect, it } from 'vitest'
import { shellQuote } from './shell-quote'

describe('shellQuote', () => {
  it('wraps a plain value in single quotes', () => {
    expect(shellQuote('prod-ecofitus-4.9.002')).toBe("'prod-ecofitus-4.9.002'")
  })

  it('escapes embedded single quotes', () => {
    expect(shellQuote("it's a tag")).toBe(String.raw`'it'\''s a tag'`)
  })

  it('neutralizes shell metacharacters as literal text', () => {
    const malicious = '$(rm -rf /); echo pwned `whoami`'
    const quoted = shellQuote(malicious)
    expect(quoted).toBe(`'${malicious}'`)
    // Nothing inside single quotes is expanded by a POSIX shell.
    expect(quoted.startsWith("'")).toBe(true)
    expect(quoted.endsWith("'")).toBe(true)
  })

  it('handles an empty string', () => {
    expect(shellQuote('')).toBe("''")
  })
})
