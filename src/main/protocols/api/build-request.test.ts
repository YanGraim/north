import { emptyApiConfig, emptyApiRequestDefinition } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { buildApiRequest } from './build-request'

describe('buildApiRequest', () => {
  it('joins relative url with interpolated baseUrl', () => {
    const built = buildApiRequest({
      definition: emptyApiRequestDefinition(),
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://{{host}}/v1',
      method: 'GET',
      url: '/users',
      variables: { host: 'api.example.com' }
    })
    expect(built.url).toBe('https://api.example.com/v1/users')
    expect(built.method).toBe('GET')
  })

  it('keeps absolute request url', () => {
    const built = buildApiRequest({
      definition: emptyApiRequestDefinition(),
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://api.example.com',
      method: 'GET',
      url: 'https://other.test/ping',
      variables: {}
    })
    expect(built.url).toBe('https://other.test/ping')
  })

  it('appends enabled query params only', () => {
    const built = buildApiRequest({
      definition: {
        ...emptyApiRequestDefinition(),
        queryParams: [
          { key: 'q', value: 'north', enabled: true },
          { key: 'off', value: 'x', enabled: false }
        ]
      },
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://api.example.com',
      method: 'GET',
      url: '/search',
      variables: {}
    })
    expect(built.url).toContain('q=north')
    expect(built.url).not.toContain('off=')
  })

  it('applies bearer auth after default headers', () => {
    const built = buildApiRequest({
      definition: emptyApiRequestDefinition(),
      apiConfig: {
        ...emptyApiConfig(),
        defaultHeaders: [{ key: 'X-Client', value: 'north', enabled: true }],
        auth: { type: 'bearer', token: '{{token}}' }
      },
      baseUrl: 'https://api.example.com',
      method: 'GET',
      url: '/',
      variables: { token: 'secret' }
    })
    expect(built.headers['X-Client']).toBe('north')
    expect(built.headers.Authorization).toBe('Bearer secret')
  })

  it('applies request auth over config auth', () => {
    const built = buildApiRequest({
      definition: {
        ...emptyApiRequestDefinition(),
        auth: { type: 'apiKey', key: 'X-Key', value: 'req', in: 'header' }
      },
      apiConfig: {
        ...emptyApiConfig(),
        auth: { type: 'bearer', token: 'cfg' }
      },
      baseUrl: 'https://api.example.com',
      method: 'GET',
      url: '/',
      variables: {}
    })
    expect(built.headers['X-Key']).toBe('req')
    expect(built.headers.Authorization).toBeUndefined()
  })

  it('encodes json body and sets content-type', () => {
    const built = buildApiRequest({
      definition: {
        ...emptyApiRequestDefinition(),
        body: { type: 'json', text: '{"ok":true}' }
      },
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://api.example.com',
      method: 'POST',
      url: '/echo',
      variables: {}
    })
    expect(built.body).toBe('{"ok":true}')
    expect(built.headers['Content-Type']).toBe('application/json')
  })

  it('strips // and /* */ comments from a json body before sending', () => {
    const built = buildApiRequest({
      definition: {
        ...emptyApiRequestDefinition(),
        body: {
          type: 'json',
          text: '{\n  // the user id\n  "id": 1 /* required */\n}'
        }
      },
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://api.example.com',
      method: 'POST',
      url: '/echo',
      variables: {}
    })
    expect(JSON.parse(built.body as string)).toEqual({ id: 1 })
  })

  it('puts apiKey in query when configured', () => {
    const built = buildApiRequest({
      definition: {
        ...emptyApiRequestDefinition(),
        auth: { type: 'apiKey', key: 'key', value: 'abc', in: 'query' }
      },
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://api.example.com',
      method: 'GET',
      url: '/items',
      variables: {}
    })
    expect(built.url).toContain('key=abc')
  })

  const files: Record<string, string> = {
    '/tmp/report.xlsx': 'xlsx-bytes',
    '/tmp/a.png': 'png-bytes',
    '/tmp/data.bin': 'raw-bytes'
  }
  const readFile = (path: string): Uint8Array<ArrayBuffer> => {
    const content = files[path]
    if (content === undefined) throw new Error('ENOENT')
    return new TextEncoder().encode(content) as Uint8Array<ArrayBuffer>
  }

  it('sends a binary body with the content-type inferred from the extension', () => {
    const built = buildApiRequest({
      definition: {
        ...emptyApiRequestDefinition(),
        body: { type: 'binary', src: '/tmp/report.xlsx' }
      },
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://api.example.com',
      method: 'PUT',
      url: '/upload',
      variables: {},
      readFile
    })
    expect(new TextDecoder().decode(built.body as Uint8Array)).toBe('xlsx-bytes')
    expect(built.headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('keeps an explicit content-type header on a binary body', () => {
    const built = buildApiRequest({
      definition: {
        ...emptyApiRequestDefinition(),
        headers: [{ key: 'content-type', value: 'application/x-custom', enabled: true }],
        body: { type: 'binary', src: '/tmp/data.bin' }
      },
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://api.example.com',
      method: 'POST',
      url: '/upload',
      variables: {},
      readFile
    })
    expect(built.headers['content-type']).toBe('application/x-custom')
    expect(built.headers['Content-Type']).toBeUndefined()
  })

  it('attaches multipart file fields next to text fields', async () => {
    const built = buildApiRequest({
      definition: {
        ...emptyApiRequestDefinition(),
        body: {
          type: 'multipart',
          fields: [
            { key: 'name', value: 'north', enabled: true },
            {
              key: 'file',
              value: '',
              enabled: true,
              type: 'file',
              src: ['/tmp/report.xlsx', '/tmp/a.png']
            },
            { key: 'off', value: '', enabled: false, type: 'file', src: ['/tmp/data.bin'] }
          ]
        }
      },
      apiConfig: emptyApiConfig(),
      baseUrl: 'https://api.example.com',
      method: 'POST',
      url: '/upload',
      variables: {},
      readFile
    })
    const form = built.body as FormData
    expect(form.get('name')).toBe('north')
    expect(form.has('off')).toBe(false)
    const uploaded = form.getAll('file') as File[]
    expect(uploaded.map((file) => file.name)).toEqual(['report.xlsx', 'a.png'])
    expect(uploaded[0].type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(uploaded[1].type).toBe('image/png')
    expect(await uploaded[0].text()).toBe('xlsx-bytes')
  })

  it('fails with a clear message when a picked file is gone', () => {
    expect(() =>
      buildApiRequest({
        definition: {
          ...emptyApiRequestDefinition(),
          body: { type: 'binary', src: '/tmp/missing.xlsx' }
        },
        apiConfig: emptyApiConfig(),
        baseUrl: 'https://api.example.com',
        method: 'POST',
        url: '/upload',
        variables: {},
        readFile
      })
    ).toThrow('Arquivo não encontrado: /tmp/missing.xlsx')
  })
})
