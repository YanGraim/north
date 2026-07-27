/** Unwrap Electron invoke wrappers and keep the underlying message. */
export function formatIpcError(error: unknown, fallback = 'Algo deu errado'): string {
  let message = error instanceof Error && error.message ? error.message : fallback
  const invokeMatch = message.match(/^Error invoking remote method '[^']+': (?:Error: )?(.+)$/s)
  if (invokeMatch?.[1]) {
    message = invokeMatch[1].trim()
  }
  return message
}
