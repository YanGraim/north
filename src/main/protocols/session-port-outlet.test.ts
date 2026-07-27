import { describe, expect, it, vi } from 'vitest'
import { SessionPortOutlet } from './session-port-outlet'

describe('SessionPortOutlet', () => {
  it('queues messages until a port is attached, then flushes', () => {
    const outlet = new SessionPortOutlet()
    const postMessage = vi.fn()

    outlet.post({ type: 'data', data: new Uint8Array([1, 2]) })
    outlet.post({ type: 'state', state: 'connected', errorMessage: null })
    expect(postMessage).not.toHaveBeenCalled()

    outlet.attach({
      postMessage,
      close: () => undefined,
      start: () => undefined,
      on: () => undefined
    })

    expect(postMessage).toHaveBeenCalledTimes(2)
    expect(postMessage.mock.calls[0]?.[0]).toMatchObject({ type: 'data' })
    expect(postMessage.mock.calls[1]?.[0]).toMatchObject({ type: 'state', state: 'connected' })
  })

  it('posts immediately after attach', () => {
    const outlet = new SessionPortOutlet()
    const postMessage = vi.fn()
    outlet.attach({
      postMessage,
      close: () => undefined,
      start: () => undefined,
      on: () => undefined
    })

    outlet.post({ type: 'error', message: 'boom' })
    expect(postMessage).toHaveBeenCalledWith({ type: 'error', message: 'boom' })
  })
})
