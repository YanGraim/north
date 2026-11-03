/** Fixed-size byte buffer that drops the oldest bytes when it overflows. */
export class ByteRing {
  private chunks: Uint8Array[] = []
  private size = 0

  constructor(private readonly maxBytes: number) {}

  push(chunk: Uint8Array): void {
    if (chunk.byteLength === 0) return
    this.chunks.push(chunk)
    this.size += chunk.byteLength
    while (this.size > this.maxBytes && this.chunks.length > 0) {
      const extra = this.size - this.maxBytes
      const first = this.chunks[0]
      if (!first) break
      if (extra >= first.byteLength) {
        this.chunks.shift()
        this.size -= first.byteLength
        continue
      }
      this.chunks[0] = first.subarray(extra)
      this.size -= extra
      break
    }
  }

  snapshot(): Uint8Array {
    const out = new Uint8Array(this.size)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.byteLength
    }
    return out
  }

  clear(): void {
    this.chunks = []
    this.size = 0
  }
}
