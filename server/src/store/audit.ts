import type { Db } from '../db'
import type { User } from './users'

export type AuditAction =
  | 'secret.create'
  | 'secret.write'
  | 'secret.delete'
  | 'secret.read'
  | 'user.create'
  | 'user.update'
  | 'grant.set'
  | 'grant.delete'

export type AuditEvent = {
  id: number
  at: string
  userId: string | null
  userEmail: string | null
  action: AuditAction
  targetType: string | null
  targetId: string | null
  targetName: string | null
  detail: Record<string, unknown>
}

export async function recordAudit(
  db: Db,
  user: User,
  action: AuditAction,
  target: { type: string; id: string; name?: string | null } | null,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await db.query(
    `INSERT INTO audit_events (user_id, user_email, action, target_type, target_id, target_name, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      user.id,
      user.email,
      action,
      target?.type ?? null,
      target?.id ?? null,
      target?.name ?? null,
      JSON.stringify(detail)
    ]
  )
}

export async function listAudit(db: Db, limit: number): Promise<AuditEvent[]> {
  const { rows } = await db.query('SELECT * FROM audit_events ORDER BY at DESC, id DESC LIMIT $1', [
    limit
  ])
  return rows.map((r) => ({
    id: Number(r.id),
    at: new Date(String(r.at)).toISOString(),
    userId: (r.user_id as string | null) ?? null,
    userEmail: (r.user_email as string | null) ?? null,
    action: r.action as AuditAction,
    targetType: (r.target_type as string | null) ?? null,
    targetId: (r.target_id as string | null) ?? null,
    targetName: (r.target_name as string | null) ?? null,
    detail: (r.detail as Record<string, unknown>) ?? {}
  }))
}
