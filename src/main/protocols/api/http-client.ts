import { API_MAX_RESPONSE_BYTES, type ApiSendResult } from '@shared/protocols'
import type { ApiHttpMethod } from '@shared/types'
import { apiErrorMessage, classifyApiError } from './errors'

type FetchWithDispatcher = (
  input: string,
  init: RequestInit & { dispatcher?: unknown }
) => Promise<Response>

function createTlsDispatcher(verifyTls: boolean): unknown {
  if (verifyTls) return undefined
  const undici = process.getBuiltinModule?.('undici') as
    | { Agent?: new (opts: unknown) => unknown }
    | undefined
  if (!undici?.Agent) return undefined
  return new undici.Agent({ connect: { rejectUnauthorized: false } })
}

async function readCappedBody(
  response: Response
): Promise<{ text: string; size: number; truncated: boolean }> {
  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    const size = new TextEncoder().encode(text).byteLength
    if (size > API_MAX_RESPONSE_BYTES) {
      return {
        text: new TextDecoder().decode(
          new TextEncoder().encode(text).slice(0, API_MAX_RESPONSE_BYTES)
        ),
        size,
        truncated: true
      }
    }
    return { text, size, truncated: false }
  }

  const chunks: Uint8Array[] = []
  let size = 0
  let truncated = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    const remaining = API_MAX_RESPONSE_BYTES - size
    if (remaining <= 0) {
      truncated = true
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
      break
    }
    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, remaining))
      size += remaining
      truncated = true
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
      break
    }
    chunks.push(value)
    size += value.byteLength
  }
  const merged = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { text: new TextDecoder().decode(merged), size, truncated }
}

export async function executeHttpRequest(opts: {
  url: string
  method: ApiHttpMethod
  headers: Record<string, string>
  body: string | URLSearchParams | FormData | null
  timeoutMs: number
  followRedirects: boolean
  verifyTls: boolean
  signal: AbortSignal
  requestId: string
}): Promise<ApiSendResult> {
  const started = Date.now()
  const controller = new AbortController()
  const onAbort = (): void => controller.abort()
  opts.signal.addEventListener('abort', onAbort)
  const timeout =
    opts.timeoutMs > 0 ? setTimeout(() => controller.abort(), opts.timeoutMs) : undefined

  const dispatcher = createTlsDispatcher(opts.verifyTls)
  const fetchFn = globalThis.fetch as FetchWithDispatcher

  try {
    const response = await fetchFn(opts.url, {
      method: opts.method,
      headers: opts.headers,
      body: opts.body ?? undefined,
      redirect: opts.followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
      dispatcher
    })
    const { text, size, truncated } = await readCappedBody(response)
    const headers: Array<{ key: string; value: string }> = []
    response.headers.forEach((value, key) => {
      headers.push({ key, value })
    })
    return {
      requestId: opts.requestId,
      status: response.status,
      statusText: response.statusText,
      headers,
      bodyText: text,
      truncated,
      durationMs: Date.now() - started,
      sizeBytes: size,
      errorKind: null,
      errorMessage: null,
      echoed: {
        method: opts.method,
        url: opts.url,
        headers: Object.entries(opts.headers).map(([key, value]) => ({ key, value }))
      }
    }
  } catch (error) {
    const kind = classifyApiError(error)
    const aborted = kind === 'aborted' && opts.signal.aborted
    return {
      requestId: opts.requestId,
      status: null,
      statusText: '',
      headers: [],
      bodyText: '',
      truncated: false,
      durationMs: Date.now() - started,
      sizeBytes: 0,
      errorKind: aborted ? 'aborted' : kind === 'aborted' ? 'timeout' : kind,
      errorMessage: apiErrorMessage(error),
      echoed: {
        method: opts.method,
        url: opts.url,
        headers: Object.entries(opts.headers).map(([key, value]) => ({ key, value }))
      }
    }
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
    opts.signal.removeEventListener('abort', onAbort)
  }
}
