export type Cidr = { family: 4 | 6; network: bigint; prefix: number }

function parseIpv4(value: string): bigint | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  let out = 0n
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    out = (out << 8n) | BigInt(n)
  }
  return out
}

function parseIpv6(value: string): bigint | null {
  if (!/^[0-9a-fA-F:]+$/.test(value)) return null
  const halves = value.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  let out = 0n
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
    out = (out << 16n) | BigInt(Number.parseInt(g, 16))
  }
  return out
}

function maskToPrefix(mask: bigint): number | null {
  let prefix = 0
  let seenZero = false
  for (let bit = 31n; bit >= 0n; bit--) {
    const set = (mask >> bit) & 1n
    if (set && seenZero) return null
    if (set) prefix++
    else seenZero = true
  }
  return prefix
}

/** Parse `a.b.c.d/n`, `a.b.c.d mask` (openvpn `route`), bare IPs, or IPv6 `x::/n`. */
export function parseCidr(input: string): Cidr | null {
  const value = input.trim()
  const spaced = value.split(/\s+/)
  if (spaced.length === 2) {
    const ip = parseIpv4(spaced[0])
    const mask = parseIpv4(spaced[1])
    if (ip === null || mask === null) return null
    const prefix = maskToPrefix(mask)
    return prefix === null ? null : normalize({ family: 4, network: ip, prefix })
  }
  const [addr, prefixRaw] = value.split('/')
  const v4 = parseIpv4(addr)
  const family: 4 | 6 = v4 !== null ? 4 : 6
  const ip = v4 ?? parseIpv6(addr)
  if (ip === null) return null
  const max = family === 4 ? 32 : 128
  if (prefixRaw !== undefined && !/^\d{1,3}$/.test(prefixRaw)) return null
  const prefix = prefixRaw === undefined ? max : Number(prefixRaw)
  if (prefix > max) return null
  return normalize({ family, network: ip, prefix })
}

function normalize(c: Cidr): Cidr {
  const bits = BigInt(c.family === 4 ? 32 : 128)
  const hostBits = bits - BigInt(c.prefix)
  return { ...c, network: (c.network >> hostBits) << hostBits }
}

export function cidrsOverlap(a: string | Cidr, b: string | Cidr): boolean {
  const x = typeof a === 'string' ? parseCidr(a) : a
  const y = typeof b === 'string' ? parseCidr(b) : b
  if (!x || !y || x.family !== y.family) return false
  const bits = BigInt(x.family === 4 ? 32 : 128)
  const shift = bits - BigInt(Math.min(x.prefix, y.prefix))
  return x.network >> shift === y.network >> shift
}
