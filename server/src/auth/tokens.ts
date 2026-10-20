import { createHash, randomBytes } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'

export type UserRole = 'admin' | 'member'
export type AccessClaims = { userId: string; role: UserRole }

const ISSUER = 'north-server'

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(
  claims: AccessClaims,
  secret: string,
  ttlSec: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(key(secret))
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, key(secret), {
    issuer: ISSUER,
    algorithms: ['HS256']
  })
  if (typeof payload.sub !== 'string') throw new Error('Token without subject')
  const role = payload.role === 'admin' ? 'admin' : 'member'
  return { userId: payload.sub, role }
}

/** Opaque, 256-bit, url-safe. Only its hash is stored. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
