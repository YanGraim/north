import { describe, expect, it } from 'vitest'
import { hashRefreshToken, newRefreshToken, signAccessToken, verifyAccessToken } from './tokens'

const secret = 'test-secret-test-secret-test-secret-42'

describe('access tokens', () => {
  it('round-trips the user id and role', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'admin' }, secret, 600)
    expect(await verifyAccessToken(token, secret)).toEqual({ userId: 'u1', role: 'admin' })
  })

  it('rejects a token signed with another secret', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'member' }, secret, 600)
    await expect(verifyAccessToken(token, `${secret}-other`)).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'member' }, secret, -10)
    await expect(verifyAccessToken(token, secret)).rejects.toThrow()
  })

  it('rejects a tampered token', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'member' }, secret, 600)
    const [h, , s] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'u2', role: 'admin' })).toString('base64url')
    await expect(verifyAccessToken(`${h}.${forged}.${s}`, secret)).rejects.toThrow()
  })
})

describe('refresh tokens', () => {
  it('are long, random and url-safe', () => {
    const a = newRefreshToken()
    const b = newRefreshToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(43)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('hash deterministically and never equal the token', () => {
    const token = newRefreshToken()
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token))
    expect(hashRefreshToken(token)).not.toBe(token)
  })
})
