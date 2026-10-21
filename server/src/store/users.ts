import { randomUUID } from 'node:crypto'
import type { UserRole } from '../auth/tokens'
import type { Db } from '../db'
import { ApiError } from '../errors'

export type User = { id: string; email: string; name: string; role: UserRole }

type UserRow = User & { disabled_at: Date | null }

export async function findActiveUser(db: Db, id: string): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    'SELECT id, email, name, role, disabled_at FROM users WHERE id = $1',
    [id]
  )
  const row = rows[0]
  if (!row || row.disabled_at) return null
  return { id: row.id, email: row.email, name: row.name, role: row.role }
}

/** Finds by e-mail or creates; the very first user of the instance becomes admin. */
export async function upsertUserByEmail(db: Db, email: string, name: string): Promise<User | null> {
  return db.transaction(async (tx) => {
    const normalized = email.trim().toLowerCase()
    const existing = await tx.query<UserRow>(
      'SELECT id, email, name, role, disabled_at FROM users WHERE email = $1',
      [normalized]
    )
    if (existing.rows[0]) {
      const row = existing.rows[0]
      return row.disabled_at
        ? null
        : { id: row.id, email: row.email, name: row.name, role: row.role }
    }
    await tx.query('LOCK TABLE users IN EXCLUSIVE MODE')
    const { rows } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM users')
    const role: UserRole = rows[0].n === 0 ? 'admin' : 'member'
    const user: User = {
      id: randomUUID(),
      email: normalized,
      name: name.trim() || normalized,
      role
    }
    await tx.query('INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, $4)', [
      user.id,
      user.email,
      user.name,
      user.role
    ])
    return user
  })
}

export type AdminUser = User & { disabled: boolean; createdAt: string }

export async function listUsers(db: Db): Promise<AdminUser[]> {
  const { rows } = await db.query<UserRow & { created_at: Date }>(
    'SELECT id, email, name, role, disabled_at, created_at FROM users ORDER BY created_at, email'
  )
  return rows.map(toAdminUser)
}

const toAdminUser = (row: UserRow & { created_at: Date | string }): AdminUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  disabled: Boolean(row.disabled_at),
  createdAt: new Date(String(row.created_at)).toISOString()
})

/** Pre-creates a member so an admin can grant access before their first sign-in. */
export async function createUser(db: Db, email: string, name: string): Promise<AdminUser> {
  const normalized = email.trim().toLowerCase()
  try {
    const { rows } = await db.query<UserRow & { created_at: Date }>(
      `INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, 'member')
       RETURNING id, email, name, role, disabled_at, created_at`,
      [randomUUID(), normalized, name.trim() || normalized]
    )
    return toAdminUser(rows[0])
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new ApiError('conflict', 'A user with this e-mail already exists')
    }
    throw error
  }
}

/**
 * Changes role and/or disables. The instance always keeps one active admin,
 * and disabling revokes every refresh token right away.
 */
export async function updateUser(
  db: Db,
  id: string,
  input: { role?: UserRole; disabled?: boolean; name?: string }
): Promise<AdminUser | null> {
  return db.transaction(async (tx) => {
    await tx.query('LOCK TABLE users IN EXCLUSIVE MODE')
    const { rows } = await tx.query<UserRow>(
      'SELECT id, email, name, role, disabled_at FROM users WHERE id = $1',
      [id]
    )
    const current = rows[0]
    if (!current) return null
    const role = input.role ?? current.role
    const disabled = input.disabled ?? Boolean(current.disabled_at)
    const losesAdmin =
      current.role === 'admin' && !current.disabled_at && (role !== 'admin' || disabled)
    if (losesAdmin) {
      const others = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM users
         WHERE role = 'admin' AND disabled_at IS NULL AND id <> $1`,
        [id]
      )
      if (others.rows[0].n === 0) {
        throw new ApiError('conflict', 'The organization needs at least one active admin')
      }
    }
    const updated = await tx.query<UserRow & { created_at: Date }>(
      `UPDATE users SET role = $2, name = $3,
         disabled_at = CASE WHEN $4::boolean THEN COALESCE(disabled_at, now()) ELSE NULL END
       WHERE id = $1 RETURNING id, email, name, role, disabled_at, created_at`,
      [id, role, input.name?.trim() || current.name, disabled]
    )
    if (disabled) {
      await tx.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [id]
      )
    }
    return toAdminUser(updated.rows[0])
  })
}

export type ExternalIdentity = {
  subject: string
  email: string
  name: string
  /** Set when Entra groups decide the role; null keeps the role managed in the panel. */
  role: UserRole | null
}

/**
 * Entra sign-in: finds the person by object id, else by e-mail (someone an
 * admin added before their first sign-in, or a dev-mode account), and links
 * the two. An e-mail already linked to another Entra account is refused —
 * a reused mailbox must not inherit someone else's access.
 */
export async function upsertUserByIdentity(
  db: Db,
  identity: ExternalIdentity,
  options: { allowNew: boolean }
): Promise<User | null> {
  return db.transaction(async (tx) => {
    await tx.query('LOCK TABLE users IN EXCLUSIVE MODE')
    const byId = await tx.query<UserRow & { external_id: string | null }>(
      'SELECT id, email, name, role, disabled_at, external_id FROM users WHERE external_id = $1',
      [identity.subject]
    )
    let row = byId.rows[0]
    if (!row) {
      const byEmail = await tx.query<UserRow & { external_id: string | null }>(
        'SELECT id, email, name, role, disabled_at, external_id FROM users WHERE email = $1',
        [identity.email]
      )
      row = byEmail.rows[0]
      if (row?.external_id) {
        throw new ApiError('conflict', 'This e-mail is already linked to another Entra account')
      }
    }
    if (row?.disabled_at) return null

    if (!row) {
      const { rows } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM users')
      if (!options.allowNew && rows[0].n > 0) {
        throw new ApiError('forbidden', 'Ask an admin to add you to this organization first')
      }
      const user: User = {
        id: randomUUID(),
        email: identity.email,
        name: identity.name.trim() || identity.email,
        role: identity.role ?? (rows[0].n === 0 ? 'admin' : 'member')
      }
      await tx.query(
        'INSERT INTO users (id, email, name, role, external_id) VALUES ($1, $2, $3, $4, $5)',
        [user.id, user.email, user.name, user.role, identity.subject]
      )
      return user
    }

    let role = identity.role ?? row.role
    if (row.role === 'admin' && role !== 'admin') {
      // Same rule as the panel: never leave the organization without an admin.
      const others = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM users
         WHERE role = 'admin' AND disabled_at IS NULL AND id <> $1`,
        [row.id]
      )
      if (others.rows[0].n === 0) role = 'admin'
    }
    const name = identity.name.trim() || row.name
    await tx.query(
      'UPDATE users SET external_id = $2, email = $3, name = $4, role = $5 WHERE id = $1',
      [row.id, identity.subject, identity.email, name, role]
    )
    return { id: row.id, email: identity.email, name, role }
  })
}
