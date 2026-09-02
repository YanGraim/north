import { describe, expect, it } from 'vitest'
import { ApiConfigSchema, emptyApiConfig } from './access'

describe('ApiConfigSchema timeoutMs', () => {
  it('defaults to 0 (no timeout)', () => {
    expect(emptyApiConfig().timeoutMs).toBe(0)
  })

  it('accepts 0 as no timeout', () => {
    expect(ApiConfigSchema.parse({ ...emptyApiConfig(), timeoutMs: 0 }).timeoutMs).toBe(0)
  })

  it('rejects a negative timeout', () => {
    expect(() => ApiConfigSchema.parse({ ...emptyApiConfig(), timeoutMs: -1 })).toThrow()
  })
})
