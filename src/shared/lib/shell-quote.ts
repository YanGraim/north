/** Single-quotes a value for safe use as one POSIX shell argument. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
