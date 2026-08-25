export function skipTrivia(sql: string, index: number): number {
  const length = sql.length
  let i = index
  while (i < length) {
    const ch = sql[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i += 1
      continue
    }
    if (ch === '-' && sql[i + 1] === '-') {
      i += 2
      while (i < length && sql[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      i += 2
      while (i < length && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1
      i = Math.min(i + 2, length)
      continue
    }
    break
  }
  return i
}

export function skipQuoted(sql: string, index: number, quote: string, closer: string): number {
  let i = index + 1
  while (i < sql.length) {
    if (quote !== '[' && sql[i] === '\\') {
      i += 2
      continue
    }
    if (sql[i] === closer) {
      if (quote !== '[' && sql[i + 1] === closer) {
        i += 2
        continue
      }
      return i + 1
    }
    i += 1
  }
  return i
}

export function skipString(sql: string, index: number): number {
  const ch = sql[index]
  if (ch === "'" || ch === '"') return skipQuoted(sql, index, ch, ch)
  if (ch === 'N' && sql[index + 1] === "'") return skipQuoted(sql, index + 1, "'", "'")
  return index + 1
}

export function skipBalancedParens(sql: string, index: number): number {
  if (sql[index] !== '(') return index
  let depth = 0
  let i = index
  while (i < sql.length) {
    const ch = sql[i]
    if (ch === "'" || ch === '"') {
      i = skipString(sql, i)
      continue
    }
    if (ch === 'N' && sql[i + 1] === "'") {
      i = skipString(sql, i)
      continue
    }
    if (ch === '`' || ch === '[') {
      const closer = ch === '`' ? '`' : ']'
      i = skipQuoted(sql, i, ch, closer)
      continue
    }
    if (ch === '(') {
      depth += 1
      i += 1
      continue
    }
    if (ch === ')') {
      depth -= 1
      i += 1
      if (depth === 0) return i
      continue
    }
    i += 1
  }
  return i
}

type IdentRead = {
  value: string
  next: number
  quoted: boolean
}

export function readIdent(sql: string, index: number): IdentRead | null {
  const i = skipTrivia(sql, index)
  const ch = sql[i]
  if (!ch) return null
  if (ch === '"' || ch === '`') {
    const start = i + 1
    const end = skipQuoted(sql, i, ch, ch) - 1
    return {
      value: sql.slice(start, end).replaceAll(`${ch}${ch}`, ch),
      next: end + 1,
      quoted: true
    }
  }
  if (ch === '[') {
    const start = i + 1
    const end = skipQuoted(sql, i, '[', ']') - 1
    return { value: sql.slice(start, end).replaceAll(']]', ']'), next: end + 1, quoted: true }
  }
  if (/[A-Za-z_@]/.test(ch)) {
    let j = i + 1
    while (j < sql.length && /[A-Za-z0-9_$@]/.test(sql[j] ?? '')) j += 1
    return { value: sql.slice(i, j), next: j, quoted: false }
  }
  return null
}

export function keywordAt(sql: string, index: number): { keyword: string; next: number } | null {
  const ident = readIdent(sql, index)
  if (!ident || ident.quoted) return null
  return { keyword: ident.value.toLowerCase(), next: ident.next }
}

export type SqlSpan = {
  start: number
  end: number
  text: string
}

/** Top-level statements split on `;` (ignores strings, comments, brackets). */
export function splitTopLevelStatements(sql: string): SqlSpan[] {
  const spans: SqlSpan[] = []
  let start = skipTrivia(sql, 0)
  let i = start
  let depth = 0
  while (i < sql.length) {
    const ch = sql[i]
    if (ch === '-' && sql[i + 1] === '-') {
      i = skipTrivia(sql, i)
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      i = skipTrivia(sql, i)
      continue
    }
    if (ch === "'" || ch === '"') {
      i = skipString(sql, i)
      continue
    }
    if (ch === 'N' && sql[i + 1] === "'") {
      i = skipString(sql, i)
      continue
    }
    if (ch === '`') {
      i = skipQuoted(sql, i, '`', '`')
      continue
    }
    if (ch === '[') {
      i = skipQuoted(sql, i, '[', ']')
      continue
    }
    if (ch === '(') {
      depth += 1
      i += 1
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      i += 1
      continue
    }
    if (ch === ';' && depth === 0) {
      const text = sql.slice(start, i).trim()
      if (text) spans.push({ start, end: i, text })
      start = skipTrivia(sql, i + 1)
      i = start
      continue
    }
    i += 1
  }
  const tail = sql.slice(start).trim()
  if (tail) spans.push({ start, end: sql.length, text: tail })
  return spans
}

export function walkTopLevelTokens(
  sql: string,
  onKeyword: (keyword: string, index: number, next: number) => void
): void {
  let i = 0
  let depth = 0
  while (i < sql.length) {
    i = skipTrivia(sql, i)
    if (i >= sql.length) break
    const ch = sql[i]
    if (ch === "'" || ch === '"') {
      i = skipString(sql, i)
      continue
    }
    if (ch === 'N' && sql[i + 1] === "'") {
      i = skipString(sql, i)
      continue
    }
    if (ch === '`') {
      i = skipQuoted(sql, i, '`', '`')
      continue
    }
    if (ch === '[') {
      i = skipQuoted(sql, i, '[', ']')
      continue
    }
    if (ch === '(') {
      depth += 1
      i += 1
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      i += 1
      continue
    }
    const word = keywordAt(sql, i)
    if (word) {
      if (depth === 0) onKeyword(word.keyword, i, word.next)
      i = word.next
      continue
    }
    i += 1
  }
}
