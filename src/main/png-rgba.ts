import { deflateSync, inflateSync } from 'node:zlib'

/** Straight RGBA, top to bottom. Enough for the tray PNGs — not a general decoder. */
export type RgbaImage = { width: number; height: number; rgba: Uint8Array }

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function unfilter(inflated: Buffer, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp
  const expected = height * (stride + 1)
  if (inflated.length < expected) throw new Error('truncated png')
  const out = new Uint8Array(width * height * bpp)
  let src = 0
  for (let y = 0; y < height; y++) {
    const filter = inflated[src]
    src += 1
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const raw = inflated[src + x]
      const left = x >= bpp ? out[row + x - bpp] : 0
      const up = y > 0 ? out[row - stride + x] : 0
      const upLeft = x >= bpp && y > 0 ? out[row - stride + x - bpp] : 0
      let value = raw
      if (filter === 1) value = raw + left
      else if (filter === 2) value = raw + up
      else if (filter === 3) value = raw + Math.floor((left + up) / 2)
      else if (filter === 4) value = raw + paeth(left, up, upLeft)
      else if (filter !== 0) throw new Error(`unsupported png filter ${filter}`)
      out[row + x] = value & 255
    }
    src += stride
  }
  return out
}

function toRgba(pixels: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  if (bpp === 4) return pixels
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    rgba[j] = pixels[i]
    rgba[j + 1] = pixels[i + 1]
    rgba[j + 2] = pixels[i + 2]
    rgba[j + 3] = 255
  }
  return rgba
}

export function decodePng(bytes: Buffer): RgbaImage {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIG)) throw new Error('not a png')
  let offset = 8
  let width = 0
  let height = 0
  let colorType = -1
  const idat: Buffer[] = []
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    if (offset + 12 + length > bytes.length) throw new Error('truncated png')
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const depth = data[8]
      colorType = data[9]
      if (depth !== 8 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        throw new Error('unsupported png')
      }
      if (colorType !== 2 && colorType !== 6) throw new Error('unsupported png color')
      if (width < 1 || height < 1 || width > 256 || height > 256) {
        throw new Error('unsupported png size')
      }
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
  }
  if (colorType !== 2 && colorType !== 6) throw new Error('png missing header')
  if (idat.length === 0) throw new Error('png missing image')
  const bpp = colorType === 6 ? 4 : 3
  const raw = unfilter(inflateSync(Buffer.concat(idat)), width, height, bpp)
  return { width, height, rgba: toRgba(raw, width, height, bpp) }
}

export function encodePng(image: RgbaImage): Buffer {
  const { width, height, rgba } = image
  if (rgba.length !== width * height * 4) throw new Error('png size mismatch')
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    const dest = y * (stride + 1)
    raw[dest] = 0
    raw.set(rgba.subarray(y * stride, y * stride + stride), dest + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}
