import { describe, expect, it } from 'vitest'
import { CreateApiCollectionInputSchema } from './api'

describe('CreateApiCollectionInputSchema', () => {
  it('creates a global collection without accessId', () => {
    const parsed = CreateApiCollectionInputSchema.parse({ name: 'WMS' })
    expect(parsed).toMatchObject({ name: 'WMS', clientId: null })
  })

  it('accepts explicit clientId', () => {
    const clientId = '11111111-1111-4111-8111-111111111111'
    const parsed = CreateApiCollectionInputSchema.parse({ name: 'WMS', clientId })
    expect(parsed.clientId).toBe(clientId)
  })

  it('ignores leftover accessId from the old collection model', () => {
    const parsed = CreateApiCollectionInputSchema.parse({
      name: 'WMS',
      accessId: '22222222-2222-4222-8222-222222222222'
    })
    expect(parsed.clientId).toBeNull()
    expect(parsed).not.toHaveProperty('accessId')
  })
})
