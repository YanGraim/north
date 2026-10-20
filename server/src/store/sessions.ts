import { randomUUID } from 'node:crypto'
import {
  type AccessClaims,
  hashRefreshToken,
  newRefreshToken,
  signAccessToken
} from '../auth/tokens'
import type { ServerConfig } from '../config'
import type { Db } from '../db'
import { unauthorized } from '../errors'
import { findActiveUser, type User } from './users'

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number }

async function issue(
  db: Db,
  config: ServerConfig,
  user: User
): Promise<TokenPair & { id: string }> {
  const refreshToken = newRefreshToken()
  const id = randomUUID()
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(secs => $4))`,
    [id, user.id, hashRefreshToken(refreshToken), config.refreshTokenTtlSec]
  )
  const claims: AccessClaims = { userId: user.id, role: user.role }
  return {
    id,
    accessToken: await signAccessToken(claims, config.jwtSecret, config.accessTokenTtlSec),
    refreshToken,
    expiresIn: config.accessTokenTtlSec
  }
}

export async function startSession(db: Db, config: ServerConfig, user: User): Promise<TokenPair> {
  const { id: _id, ...pair } = await issue(db, config, user)
  return pair
}

/**
 * Rotates a refresh token. Presenting one that was already rotated means it
 * leaked: every session of that user is revoked (refresh-token reuse detection).
 */
export async function rotateSession(
  db: Db,
  config: ServerConfig,
  refreshToken: string
): Promise<TokenPair> {
  const { rows } = await db.query<{
    id: string
    user_id: string
    revoked_at: Date | null
    expired: boolean
  }>(
    `SELECT id, user_id, revoked_at, expires_at <= now() AS expired
     FROM refresh_tokens WHERE token_hash = $1`,
    [hashRefreshToken(refreshToken)]
  )
  const row = rows[0]
  if (!row) throw unauthorized()
  if (row.revoked_at) {
    await revokeAllForUser(db, row.user_id)
    throw unauthorized()
  }
  if (row.expired) throw unauthorized()
  const user = await findActiveUser(db, row.user_id)
  if (!user) {
    await revokeAllForUser(db, row.user_id)
    throw unauthorized()
  }
  const next = await issue(db, config, user)
  await db.query('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1', [
    row.id,
    next.id
  ])
  const { id: _id, ...pair } = next
  return pair
}

export async function endSession(db: Db, refreshToken: string): Promise<void> {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashRefreshToken(refreshToken)]
  )
}

export async function revokeAllForUser(db: Db, userId: string): Promise<void> {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  )
}
