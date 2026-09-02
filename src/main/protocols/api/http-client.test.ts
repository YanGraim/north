import { afterEach, describe, expect, it, vi } from 'vitest'
import { executeHttpRequest } from './http-client'

function abortError(): Error {
  const error = new Error('This operation was aborted')
  error.name = 'AbortError'
  return error
}

function hangingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal
        if (!signal) return
        if (signal.aborted) {
          reject(abortError())
          return
        }
        signal.addEventListener('abort', () => reject(abortError()))
      })
    })
  )
}

const baseOpts = {
  url: 'https://example.com/slow',
  method: 'GET' as const,
  headers: {},
  body: null,
  followRedirects: true,
  verifyTls: true,
  requestId: '11111111-1111-1111-1111-111111111111'
}

describe('executeHttpRequest timeout', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not abort when timeoutMs is 0', async () => {
    vi.useFakeTimers()
    hangingFetch()
    const controller = new AbortController()
    const promise = executeHttpRequest({
      ...baseOpts,
      timeoutMs: 0,
      signal: controller.signal
    })

    await vi.advanceTimersByTimeAsync(60_000)
    controller.abort()
    const result = await promise
    expect(result.errorKind).toBe('aborted')
  })

  it('aborts with timeout when timeoutMs > 0', async () => {
    vi.useFakeTimers()
    hangingFetch()
    const controller = new AbortController()
    const promise = executeHttpRequest({
      ...baseOpts,
      timeoutMs: 5_000,
      signal: controller.signal
    })

    await vi.advanceTimersByTimeAsync(5_000)
    const result = await promise
    expect(result.errorKind).toBe('timeout')
  })
})
