import { randomUUID } from 'node:crypto'
import type { Db } from '../db'
import { ApiError } from '../errors'
import { open, seal } from '../secrets/envelope'

function requireKey(masterKey: Buffer | null): Buffer {
  if (!masterKey) {
    throw new ApiError(
      'secrets_unavailable',
      'This North Server has no master key, so it cannot store passwords. Ask the operator to set NORTH_MASTER_KEY.'
    )
  }
  return masterKey
}

export async function createSecret(
  db: Db,
  masterKey: Buffer | null,
  userId: string,
  value: string
): Promise<string> {
  const key = requireKey(masterKey)
  const id = randomUUID()
  const sealed = seal(key, value, id)
  await db.query(
    'INSERT INTO secrets (id, wrapped_key, ciphertext, created_by) VALUES ($1, $2, $3, $4)',
    [id, sealed.wrappedKey, sealed.ciphertext, userId]
  )
  return id
}

/** What uses a secret: one connection or one access. */
export type SecretHolder = { type: 'connection' | 'access'; id: string; name: string }

/** Who a secret belongs to: the connection or access that uses it, or its author while still loose. */
export async function secretOwner(
  db: Db,
  id: string
): Promise<{ createdBy: string | null; holder: SecretHolder | null } | null> {
  const { rows } = await db.query<{
    created_by: string | null
    connection_id: string | null
    connection_name: string | null
    access_id: string | null
    access_name: string | null
  }>(
    `SELECT s.created_by, c.id AS connection_id, c.name AS connection_name,
            a.id AS access_id, a.name AS access_name
     FROM secrets s
     LEFT JOIN connections c ON c.credential_ref = s.id
     LEFT JOIN accesses a ON a.credential_ref = s.id
     WHERE s.id = $1 LIMIT 1`,
    [id]
  )
  const row = rows[0]
  if (!row) return null
  const holder: SecretHolder | null = row.connection_id
    ? { type: 'connection', id: row.connection_id, name: row.connection_name ?? '' }
    : row.access_id
      ? { type: 'access', id: row.access_id, name: row.access_name ?? '' }
      : null
  return { createdBy: row.created_by, holder }
}

export async function replaceSecret(
  db: Db,
  masterKey: Buffer | null,
  id: string,
  value: string
): Promise<boolean> {
  const sealed = seal(requireKey(masterKey), value, id)
  const { rows } = await db.query(
    'UPDATE secrets SET wrapped_key = $2, ciphertext = $3, updated_at = now() WHERE id = $1 RETURNING id',
    [id, sealed.wrappedKey, sealed.ciphertext]
  )
  return rows.length > 0
}

export async function deleteSecret(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM secrets WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

/** Plaintext of a secret that a connection or access uses; null when nothing uses it. */
export async function readHeldSecret(
  db: Db,
  masterKey: Buffer | null,
  id: string
): Promise<{ value: string; holder: SecretHolder } | null> {
  const key = requireKey(masterKey)
  const owner = await secretOwner(db, id)
  if (!owner?.holder) return null
  const { rows } = await db.query<{ wrapped_key: string; ciphertext: string }>(
    'SELECT wrapped_key, ciphertext FROM secrets WHERE id = $1',
    [id]
  )
  if (!rows[0]) return null
  return {
    value: open(key, { wrappedKey: rows[0].wrapped_key, ciphertext: rows[0].ciphertext }, id),
    holder: owner.holder
  }
}

/** Re-seals a secret under a new id (duplicate connection). */
export async function copySecret(
  db: Db,
  masterKey: Buffer | null,
  userId: string,
  id: string
): Promise<string | null> {
  const key = requireKey(masterKey)
  const { rows } = await db.query<{ wrapped_key: string; ciphertext: string }>(
    'SELECT wrapped_key, ciphertext FROM secrets WHERE id = $1',
    [id]
  )
  if (!rows[0]) return null
  const value = open(key, { wrappedKey: rows[0].wrapped_key, ciphertext: rows[0].ciphertext }, id)
  return createSecret(db, key, userId, value)
}
