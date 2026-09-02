/** Unwrap Electron invoke wrappers and keep the underlying message. */
export function formatIpcError(error: unknown, fallback = 'Algo deu errado'): string {
  let message = error instanceof Error && error.message ? error.message : fallback
  const invokeMatch = message.match(/^Error invoking remote method '[^']+': (?:Error: )?(.+)$/s)
  if (invokeMatch?.[1]) {
    message = invokeMatch[1].trim()
  }
  if (isZodIssueDump(message)) {
    return fallback
  }
  return message
}

function isZodIssueDump(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed.startsWith('[')) return false
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return (
      Array.isArray(parsed) &&
      parsed.some(
        (item) => typeof item === 'object' && item !== null && 'code' in item && 'path' in item
      )
    )
  } catch {
    return false
  }
}
