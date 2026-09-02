import type { ApiErrorKind } from '@shared/protocols'

function readCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const record = error as { cause?: unknown; code?: unknown }
  if (typeof record.code === 'string') return record.code
  if (record.cause && typeof record.cause === 'object') {
    const cause = record.cause as { code?: unknown }
    if (typeof cause.code === 'string') return cause.code
  }
  return undefined
}

function readName(error: unknown): string | undefined {
  if (error instanceof Error) return error.name
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

export function classifyApiError(error: unknown): ApiErrorKind {
  const name = readName(error)
  const code = readCode(error)?.toUpperCase() ?? ''
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  if (name === 'AbortError' || code === 'ABORT_ERR' || message.includes('aborted')) {
    return 'aborted'
  }
  if (
    name === 'TimeoutError' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    message.includes('timeout')
  ) {
    return 'timeout'
  }
  if (
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ERR_NAME_NOT_RESOLVED' ||
    message.includes('getaddrinfo')
  ) {
    return 'dns'
  }
  if (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    code.includes('CERT') ||
    message.includes('certificate') ||
    message.includes('ssl') ||
    message.includes('tls')
  ) {
    return 'tls'
  }
  if (error instanceof TypeError && /url/i.test(error.message)) {
    return 'invalid-url'
  }
  if (message.includes('invalid url') || message.includes('invalidurl')) {
    return 'invalid-url'
  }
  return 'network'
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Falha na requisição HTTP'
}
