import { describe, expect, it } from 'vitest'
import { classifyApiError } from './errors'

describe('classifyApiError', () => {
  it('classifies abort', () => {
    const error = new Error('The operation was aborted')
    error.name = 'AbortError'
    expect(classifyApiError(error)).toBe('aborted')
  })

  it('classifies timeout', () => {
    const error = new Error('timeout')
    error.name = 'TimeoutError'
    expect(classifyApiError(error)).toBe('timeout')
  })

  it('classifies dns from cause.code', () => {
    const error = Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    expect(classifyApiError(error)).toBe('dns')
  })

  it('classifies tls', () => {
    const error = Object.assign(new Error('unable to verify'), {
      cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }
    })
    expect(classifyApiError(error)).toBe('tls')
  })

  it('classifies invalid url', () => {
    expect(classifyApiError(new TypeError('Failed to parse URL from not a url'))).toBe(
      'invalid-url'
    )
  })

  it('falls back to network', () => {
    expect(classifyApiError(new Error('ECONNRESET'))).toBe('network')
  })
})
