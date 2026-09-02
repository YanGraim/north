import { interpolate, interpolateDeep } from '@shared/lib/interpolate'
import type { ApiConfig, ApiKeyValue } from '@shared/types'
import type { ApiHttpMethod, ApiRequestDefinition } from '@shared/types/api'

export type BuiltApiRequest = {
  url: string
  method: ApiHttpMethod
  headers: Record<string, string>
  body: string | URLSearchParams | FormData | null
}

function enabledPairs(items: ApiKeyValue[]): ApiKeyValue[] {
  return items.filter((item) => item.enabled && item.key.trim().length > 0)
}

function joinUrl(requestUrl: string, baseUrl: string): string {
  const trimmed = requestUrl.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = baseUrl.trim()
  if (!base) return trimmed
  if (!trimmed) return base
  const left = base.replace(/\/+$/, '')
  const right = trimmed.replace(/^\/+/, '')
  return `${left}/${right}`
}

function applyAuth(
  headers: Record<string, string>,
  url: URL,
  auth: ApiConfig['auth']
): { headers: Record<string, string>; url: URL } {
  if (auth.type === 'none') {
    return { headers, url }
  }
  if (auth.type === 'bearer') {
    if (auth.token.trim()) {
      headers.Authorization = `Bearer ${auth.token}`
    }
    return { headers, url }
  }
  if (auth.type === 'basic') {
    const token = btoa(`${auth.username}:${auth.password}`)
    headers.Authorization = `Basic ${token}`
    return { headers, url }
  }
  if (auth.in === 'query') {
    if (auth.key.trim()) url.searchParams.set(auth.key, auth.value)
    return { headers, url }
  }
  if (auth.key.trim()) {
    headers[auth.key] = auth.value
  }
  return { headers, url }
}

function mergeHeaders(layers: ApiKeyValue[][]): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const layer of layers) {
    for (const item of enabledPairs(layer)) {
      headers[item.key] = item.value
    }
  }
  return headers
}

function encodeBody(
  body: ApiRequestDefinition['body'],
  headers: Record<string, string>
): string | URLSearchParams | FormData | null {
  if (body.type === 'none') return null
  if (body.type === 'json') {
    if (!hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }
    return body.text
  }
  if (body.type === 'text') {
    if (!hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'text/plain'
    }
    return body.text
  }
  if (body.type === 'form-urlencoded') {
    if (!hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    const params = new URLSearchParams()
    for (const field of enabledPairs(body.fields)) {
      params.append(field.key, field.value)
    }
    return params
  }
  const form = new FormData()
  for (const field of enabledPairs(body.fields)) {
    form.append(field.key, field.value)
  }
  return form
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase()
  return Object.keys(headers).some((key) => key.toLowerCase() === lower)
}

export function buildApiRequest(opts: {
  definition: ApiRequestDefinition
  apiConfig: ApiConfig
  baseUrl: string
  method: ApiHttpMethod
  url: string
  variables: Record<string, string>
}): BuiltApiRequest {
  const interpolatedUrl = interpolate(opts.url, opts.variables)
  const interpolatedBase = interpolate(opts.baseUrl, opts.variables)
  const definition = interpolateDeep(opts.definition, opts.variables)
  const apiConfig = interpolateDeep(opts.apiConfig, opts.variables)

  const joined = joinUrl(interpolatedUrl, interpolatedBase)
  let url: URL
  try {
    url = new URL(joined)
  } catch {
    throw new Error('URL inválida')
  }

  for (const param of enabledPairs(definition.queryParams)) {
    url.searchParams.append(param.key, param.value)
  }

  let headers = mergeHeaders([apiConfig.defaultHeaders, definition.headers])
  const auth = definition.auth ?? apiConfig.auth
  const applied = applyAuth(headers, url, auth)
  headers = applied.headers

  const body = encodeBody(definition.body, headers)

  return {
    url: applied.url.toString(),
    method: opts.method,
    headers,
    body: opts.method === 'GET' || opts.method === 'HEAD' ? null : body
  }
}
