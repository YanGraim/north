import type { ConnectionSecret } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type ConnectionSecretRow = {
  id: string
  connection_id: string
  kind: string
  credential_ref: string
  created_at: string
  updated_at: string
}

function mapSecret(row: ConnectionSecretRow): ConnectionSecret {
  return {
    id: row.id,
    connectionId: row.connection_id,
    kind: row.kind,
    credentialRef: row.credential_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ConnectionSecretsRepository {
  private readonly listByConnectionStmt
  private readonly getByKindStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt
  private readonly deleteByKindStmt

  /** `table` is the organization copy (no foreign keys) for runs of a server's workflows. */
  constructor(
    db: SqliteDatabase,
    table: 'connection_secrets' | 'organization_connection_secrets' = 'connection_secrets'
  ) {
    this.listByConnectionStmt = db.prepare(`
      SELECT id, connection_id, kind, credential_ref, created_at, updated_at
      FROM ${table}
      WHERE connection_id = ?
      ORDER BY kind COLLATE NOCASE ASC
    `)
    this.getByKindStmt = db.prepare(`
      SELECT id, connection_id, kind, credential_ref, created_at, updated_at
      FROM ${table}
      WHERE connection_id = ? AND kind = ?
    `)
    this.getStmt = db.prepare(`
      SELECT id, connection_id, kind, credential_ref, created_at, updated_at
      FROM ${table}
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO ${table}
        (id, connection_id, kind, credential_ref, created_at, updated_at)
      VALUES (@id, @connection_id, @kind, @credential_ref, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE ${table}
      SET credential_ref = @credential_ref, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`)
    this.deleteByKindStmt = db.prepare(`DELETE FROM ${table} WHERE connection_id = ? AND kind = ?`)
  }

  listByConnection(connectionId: string): ConnectionSecret[] {
    return (this.listByConnectionStmt.all(connectionId) as ConnectionSecretRow[]).map(mapSecret)
  }

  get(id: string): ConnectionSecret | null {
    const row = this.getStmt.get(id) as ConnectionSecretRow | undefined
    return row ? mapSecret(row) : null
  }

  getByKind(connectionId: string, kind: string): ConnectionSecret | null {
    const row = this.getByKindStmt.get(connectionId, kind) as ConnectionSecretRow | undefined
    return row ? mapSecret(row) : null
  }

  upsert(connectionId: string, kind: string, credentialRef: string): ConnectionSecret {
    const existing = this.getByKind(connectionId, kind)
    const now = nowIso()
    if (existing) {
      this.updateStmt.run({
        id: existing.id,
        credential_ref: credentialRef,
        updated_at: now
      })
      return {
        ...existing,
        credentialRef,
        updatedAt: now
      }
    }
    const created: ConnectionSecret = {
      id: newId(),
      connectionId,
      kind,
      credentialRef,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: created.id,
      connection_id: created.connectionId,
      kind: created.kind,
      credential_ref: created.credentialRef,
      created_at: created.createdAt,
      updated_at: created.updatedAt
    })
    return created
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }

  deleteByKind(connectionId: string, kind: string): boolean {
    return this.deleteByKindStmt.run(connectionId, kind).changes > 0
  }
}
