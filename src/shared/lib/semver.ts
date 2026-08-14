/** Comparação semver simples (x.y.z). Só true se remote > current. */
export function isNewerVersion(remote: string, current: string): boolean {
  const parse = (value: string): number[] =>
    value
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((part) => Number.parseInt(part, 10))
      .map((n) => (Number.isFinite(n) ? n : 0))

  const remoteParts = parse(remote)
  const currentParts = parse(current)
  const length = Math.max(remoteParts.length, currentParts.length)

  for (let i = 0; i < length; i++) {
    const a = remoteParts[i] ?? 0
    const b = currentParts[i] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}
