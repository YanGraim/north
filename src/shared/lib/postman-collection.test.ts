import { emptyApiRequestDefinition } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { parsePostmanCollection, serializePostmanCollection } from './postman-collection'

describe('postman collection', () => {
  it('parses a v2.1 collection with folders and requests', () => {
    const parsed = parsePostmanCollection({
      info: { name: 'Demo', description: 'demo' },
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'List',
              request: {
                method: 'GET',
                url: '{{baseUrl}}/users',
                header: [{ key: 'Accept', value: 'application/json' }]
              }
            }
          ]
        }
      ]
    })
    expect(parsed.name).toBe('Demo')
    expect(parsed.folders).toHaveLength(1)
    expect(parsed.requests).toHaveLength(1)
    expect(parsed.requests[0]?.method).toBe('GET')
    expect(parsed.requests[0]?.url).toBe('{{baseUrl}}/users')
  })

  it('exports secrets only as placeholders', () => {
    const json = serializePostmanCollection({
      name: 'Demo',
      description: null,
      folders: [],
      requests: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          collectionId: '22222222-2222-2222-2222-222222222222',
          folderId: null,
          name: 'Login',
          description: null,
          method: 'POST',
          url: '{{baseUrl}}/login',
          definition: {
            ...emptyApiRequestDefinition(),
            auth: { type: 'bearer', token: 'super-secret' }
          },
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    })
    const dumped = JSON.stringify(json)
    expect(dumped).toContain('{{token}}')
    expect(dumped).not.toContain('super-secret')
  })

  it('imports form-data file fields and binary bodies', () => {
    const parsed = parsePostmanCollection({
      info: { name: 'Uploads' },
      item: [
        {
          name: 'Form',
          request: {
            method: 'POST',
            url: 'https://x.test/upload',
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'name', value: 'north', type: 'text' },
                { key: 'file', type: 'file', src: '/tmp/report.xlsx' },
                { key: 'many', type: 'file', src: ['/tmp/a.png', '/tmp/b.png'] }
              ]
            }
          }
        },
        {
          name: 'Raw file',
          request: {
            method: 'PUT',
            url: 'https://x.test/blob',
            body: { mode: 'file', file: { src: '/tmp/data.bin' } }
          }
        }
      ]
    })
    expect(parsed.requests[0].definition.body).toEqual({
      type: 'multipart',
      fields: [
        { key: 'name', value: 'north', enabled: true },
        { key: 'file', value: '', enabled: true, type: 'file', src: ['/tmp/report.xlsx'] },
        { key: 'many', value: '', enabled: true, type: 'file', src: ['/tmp/a.png', '/tmp/b.png'] }
      ]
    })
    expect(parsed.requests[1].definition.body).toEqual({ type: 'binary', src: '/tmp/data.bin' })
  })

  it('round-trips file bodies through export', () => {
    const request = (definition: ReturnType<typeof emptyApiRequestDefinition>) => ({
      id: '11111111-1111-1111-1111-111111111111',
      collectionId: '22222222-2222-2222-2222-222222222222',
      folderId: null,
      name: 'Upload',
      description: null,
      method: 'POST' as const,
      url: 'https://x.test/upload',
      definition,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    const json = serializePostmanCollection({
      name: 'Uploads',
      description: null,
      folders: [],
      requests: [
        request({
          ...emptyApiRequestDefinition(),
          body: {
            type: 'multipart',
            fields: [
              { key: 'file', value: '', enabled: true, type: 'file', src: ['/tmp/report.xlsx'] }
            ]
          }
        }),
        request({ ...emptyApiRequestDefinition(), body: { type: 'binary', src: '/tmp/data.bin' } })
      ]
    })
    const [form, raw] = json.item
    expect(form.request?.body).toEqual({
      mode: 'formdata',
      formdata: [{ key: 'file', disabled: false, type: 'file', src: '/tmp/report.xlsx' }]
    })
    expect(raw.request?.body).toEqual({ mode: 'file', file: { src: '/tmp/data.bin' } })
    const reparsed = parsePostmanCollection(json)
    expect(reparsed.requests[1].definition.body).toEqual({ type: 'binary', src: '/tmp/data.bin' })
  })
})
