const CHARACTER_TYPE =
  /^(?:national\s+)?(?:character(?:\s+varying)?|char|varchar|nchar|nvarchar|bpchar|character varying)$/i

export function isCharacterDataType(dataType: string): boolean {
  const trimmed = dataType.trim()
  if (CHARACTER_TYPE.test(trimmed)) return true
  const base = trimmed.replace(/\s*\(.*\)\s*$/, '').trim()
  return CHARACTER_TYPE.test(base)
}

export function normalizeCharacterMaximumLength(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

/** CHAR(1) / VARCHAR(n) from SQLite PRAGMA type; DECIMAL(10,2) is ignored. */
export function parseSqliteCharacterMaximumLength(declaredType: string): number | null {
  const match = declaredType
    .trim()
    .match(
      /^(?:national\s+)?(?:n?(?:var)?char|character(?:\s+varying)?|nvarchar|varchar|nchar|bpchar)\s*\(\s*(\d+)\s*\)\s*$/i
    )
  if (!match?.[1]) return null
  return normalizeCharacterMaximumLength(match[1])
}

export function characterLimitForColumn(input: {
  dataType: string
  characterMaximumLength?: number | null
}): number | null {
  if (!isCharacterDataType(input.dataType)) return null
  return input.characterMaximumLength ?? null
}

/** Allow typing NULL (and prefixes) on nullable columns; otherwise cap at maxLength. */
export function applyCharacterMaxLength(
  raw: string,
  maxLength: number | null,
  options: { nullable: boolean; committing?: boolean }
): string {
  if (maxLength == null || maxLength <= 0) return raw
  const trimmedUpper = raw.trim().toUpperCase()
  if (options.nullable && trimmedUpper === 'NULL') return raw
  if (!options.committing && options.nullable) {
    const typed = raw.toUpperCase()
    if (typed.length > 0 && typed.length < 4 && 'NULL'.startsWith(typed)) return raw
  }
  if (raw.length <= maxLength) return raw
  return raw.slice(0, maxLength)
}
