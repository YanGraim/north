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
})
