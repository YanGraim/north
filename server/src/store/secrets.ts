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

export async function secretExists(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('SELECT 1 FROM secrets WHERE id = $1', [id])
  return rows.length > 0
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

/** Plaintext of a secret plus the connection that owns it; null when no connection uses it. */
export async function readConnectionSecret(
  db: Db,
  masterKey: Buffer | null,
  id: string
): Promise<{ value: string; connection: { id: string; name: string } } | null> {
  const key = requireKey(masterKey)
  const { rows } = await db.query<{
    wrapped_key: string
    ciphertext: string
    connection_id: string
    connection_name: string
  }>(
    `SELECT s.id, s.wrapped_key, s.ciphertext, c.id AS connection_id, c.name AS connection_name
     FROM secrets s INNER JOIN connections c ON c.credential_ref = s.id
     WHERE s.id = $1 LIMIT 1`,
    [id]
  )
  const row = rows[0]
  if (!row) return null
  return {
    value: open(key, { wrappedKey: row.wrapped_key, ciphertext: row.ciphertext }, id),
    connection: { id: row.connection_id, name: row.connection_name }
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
