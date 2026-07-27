import { coerceBytes, type SessionDataPort, type SessionPortMessage } from '@shared/protocols'

const MAX_QUEUED = 256

/**
 * Queues outbound session messages until the renderer MessagePort is attached.
 * Without this, early shell/banner bytes emitted during `createSession` are dropped
 * (ProtocolManager only calls `attachPort` after the driver returns).
 */
export class SessionPortOutlet {
  private port: SessionDataPort | null = null
  private queue: SessionPortMessage[] = []

  attach(port: SessionDataPort): void {
    this.port = port
    const pending = this.queue
    this.queue = []
    for (const message of pending) {
      this.send(message)
    }
  }

  detach(): void {
    this.port = null
    this.queue = []
  }

  post(message: SessionPortMessage): void {
    if (!this.port) {
      if (this.queue.length >= MAX_QUEUED) {
        this.queue.shift()
      }
      this.queue.push(message)
      return
    }
    this.send(message)
  }

  private send(message: SessionPortMessage): void {
    try {
      // Prefer ArrayBuffer on the wire — more reliable across Electron MessagePort realms
      // than TypedArray instanceof checks on the other side.
      if (message.type === 'data') {
        const bytes = coerceBytes(message.data)
        if (!bytes) return
        const buffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer
        this.port?.postMessage({ type: 'data', data: buffer })
        return
      }
      this.port?.postMessage(message)
    } catch {
      // port may already be closed
    }
  }
}
