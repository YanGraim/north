import {
  type ApiAuth,
  type ApiBody,
  type ApiFolder,
  type ApiHttpMethod,
  ApiHttpMethodSchema,
  type ApiKeyValue,
  type ApiRequest,
  type ApiRequestDefinition,
  emptyApiRequestDefinition
} from '@shared/types'

const POSTMAN_V21_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'

export type PostmanCollectionJson = {
  info: { name: string; description?: string; schema?: string }
  item: PostmanItem[]
}

type PostmanItem = {
  name?: string
  item?: PostmanItem[]
  request?: PostmanRequest
}

type PostmanRequest = {
  method?: string
  url?: string | { raw?: string }
  header?: Array<{ key?: string; value?: string; disabled?: boolean }>
  body?: {
    mode?: string
    raw?: string
    urlencoded?: Array<{ key?: string; value?: string; disabled?: boolean }>
    formdata?: Array<{ key?: string; value?: string; disabled?: boolean }>
  }
  auth?: {
    type?: string
    bearer?: Array<{ key?: string; value?: string }>
    basic?: Array<{ key?: string; value?: string }>
    apikey?: Array<{ key?: string; value?: string }>
  }
}

export type ParsedPostmanCollection = {
  name: string
  description: string | null
  folders: Array<{ tempId: string; parentTempId: string | null; name: string }>
  requests: Array<{
    folderTempId: string | null
    name: string
    method: ApiHttpMethod
    url: string
    definition: ApiRequestDefinition
  }>
}

let tempSeq = 0
function nextTempId(): string {
  tempSeq += 1
  return `tmp-${tempSeq}`
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function pairValue(
  entries: Array<{ key?: string; value?: string }> | undefined,
  key: string
): string {
  return entries?.find((entry) => entry.key === key)?.value ?? ''
}

function toKeyValues(
  entries: Array<{ key?: string; value?: string; disabled?: boolean }> | undefined
): ApiKeyValue[] {
  if (!entries) return []
  return entries
    .filter((entry) => asString(entry.key).trim().length > 0)
    .map((entry) => ({
      key: asString(entry.key),
      value: asString(entry.value),
      enabled: entry.disabled !== true
    }))
}

function parseUrl(url: PostmanRequest['url']): string {
  if (typeof url === 'string') return url
  return asString(url?.raw)
}

function parseMethod(method: string | undefined): ApiHttpMethod {
  const upper = asString(method).toUpperCase()
  const parsed = ApiHttpMethodSchema.safeParse(upper)
  return parsed.success ? parsed.data : 'GET'
}

function parseBody(body: PostmanRequest['body'] | undefined): ApiBody {
  if (!body || body.mode === 'none' || !body.mode) return { type: 'none' }
  if (body.mode === 'urlencoded') {
    return { type: 'form-urlencoded', fields: toKeyValues(body.urlencoded) }
  }
  if (body.mode === 'formdata') {
    return { type: 'multipart', fields: toKeyValues(body.formdata) }
  }
  const raw = asString(body.raw)
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { type: 'json', text: raw }
  }
  return { type: 'text', text: raw }
}

function parseAuth(auth: PostmanRequest['auth'] | undefined): ApiAuth | null {
  if (!auth || auth.type === 'noauth' || auth.type === 'none') return null
  if (auth.type === 'bearer') {
    return {
      type: 'bearer',
      token: pairValue(auth.bearer, 'token') || asString(auth.bearer?.[0]?.value)
    }
  }
  if (auth.type === 'basic') {
    return {
      type: 'basic',
      username: pairValue(auth.basic, 'username'),
      password: pairValue(auth.basic, 'password')
    }
  }
  if (auth.type === 'apikey') {
    const key = pairValue(auth.apikey, 'key')
    const value = pairValue(auth.apikey, 'value')
    const location = pairValue(auth.apikey, 'in') === 'query' ? 'query' : 'header'
    return { type: 'apiKey', key, value, in: location }
  }
  return null
}

function walkItems(
  items: PostmanItem[] | undefined,
  parentTempId: string | null,
  out: ParsedPostmanCollection
): void {
  if (!items) return
  for (const item of items) {
    const name = asString(item.name).trim() || 'Untitled'
    if (Array.isArray(item.item)) {
      const folderTempId = nextTempId()
      out.folders.push({ tempId: folderTempId, parentTempId, name })
      walkItems(item.item, folderTempId, out)
      continue
    }
    if (item.request) {
      const definition = emptyApiRequestDefinition()
      definition.headers = toKeyValues(item.request.header)
      definition.body = parseBody(item.request.body)
      definition.auth = parseAuth(item.request.auth)
      out.requests.push({
        folderTempId: parentTempId,
        name,
        method: parseMethod(item.request.method),
        url: parseUrl(item.request.url),
        definition
      })
    }
  }
}

export function parsePostmanCollection(raw: unknown): ParsedPostmanCollection {
  tempSeq = 0
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON de collection inválido')
  }
  const data = raw as PostmanCollectionJson
  const name = asString(data.info?.name).trim()
  if (!name) {
    throw new Error('Collection Postman sem nome')
  }
  const parsed: ParsedPostmanCollection = {
    name,
    description: asString(data.info?.description).trim() || null,
    folders: [],
    requests: []
  }
  walkItems(Array.isArray(data.item) ? data.item : [], null, parsed)
  return parsed
}

function authToPostman(auth: ApiAuth | null): PostmanRequest['auth'] | undefined {
  if (!auth || auth.type === 'none') return { type: 'noauth' }
  if (auth.type === 'bearer') {
    return { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] }
  }
  if (auth.type === 'basic') {
    return {
      type: 'basic',
      basic: [
        { key: 'username', value: '{{username}}' },
        { key: 'password', value: '{{password}}' }
      ]
    }
  }
  return {
    type: 'apikey',
    apikey: [
      { key: 'key', value: auth.key || '{{apiKey}}' },
      { key: 'value', value: '{{apiKey}}' },
      { key: 'in', value: auth.in }
    ]
  }
}

function bodyToPostman(body: ApiBody): PostmanRequest['body'] | undefined {
  if (body.type === 'none') return undefined
  if (body.type === 'form-urlencoded') {
    return {
      mode: 'urlencoded',
      urlencoded: body.fields.map((field) => ({
        key: field.key,
        value: field.value,
        disabled: !field.enabled
      }))
    }
  }
  if (body.type === 'multipart') {
    return {
      mode: 'formdata',
      formdata: body.fields.map((field) => ({
        key: field.key,
        value: field.value,
        disabled: !field.enabled
      }))
    }
  }
  return { mode: 'raw', raw: body.text }
}

function headersToPostman(headers: ApiKeyValue[]): PostmanRequest['header'] {
  return headers.map((header) => ({
    key: header.key,
    value: header.value,
    disabled: !header.enabled
  }))
}

export function serializePostmanCollection(input: {
  name: string
  description: string | null
  folders: ApiFolder[]
  requests: ApiRequest[]
}): PostmanCollectionJson {
  const childrenOf = (parentId: string | null): PostmanItem[] => {
    const folders = input.folders.filter((folder) => folder.parentFolderId === parentId)
    const requests = input.requests.filter((request) => request.folderId === parentId)
    const folderItems: PostmanItem[] = folders.map((folder) => ({
      name: folder.name,
      item: childrenOf(folder.id)
    }))
    const requestItems: PostmanItem[] = requests.map((request) => ({
      name: request.name,
      request: {
        method: request.method,
        url: request.url,
        header: headersToPostman(request.definition.headers),
        body: bodyToPostman(request.definition.body),
        auth: authToPostman(request.definition.auth) ?? { type: 'noauth' }
      }
    }))
    return [...folderItems, ...requestItems]
  }

  return {
    info: {
      name: input.name,
      description: input.description ?? undefined,
      schema: POSTMAN_V21_SCHEMA
    },
    item: childrenOf(null)
  }
}
