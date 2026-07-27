/** Coerce MessagePort payloads to bytes across Electron renderer/main realms. */
export function coerceBytes(raw: unknown): Uint8Array | null {
  if (raw == null) return null
  if (raw instanceof Uint8Array) return raw
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
    return Uint8Array.from(raw)
  }
  if (ArrayBuffer.isView(raw)) {
    const view = raw as ArrayBufferView
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  }
  if (Array.isArray(raw) && raw.every((n) => typeof n === 'number')) {
    return Uint8Array.from(raw)
  }
  return null
}
