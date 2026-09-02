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
})
