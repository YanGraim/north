import type { CreateEnvironmentInput, Environment, UpdateEnvironmentInput } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type EnvironmentRow = {
  id: string
  client_id: string
  name: string
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function mapEnvironment(row: EnvironmentRow): Environment {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    notes: row.notes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class EnvironmentsRepository {
  private readonly listAllStmt
  private readonly listByClientStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listAllStmt = db.prepare(`
      SELECT id, client_id, name, notes, sort_order, created_at, updated_at
      FROM environments
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.listByClientStmt = db.prepare(`
      SELECT id, client_id, name, notes, sort_order, created_at, updated_at
      FROM environments
      WHERE client_id = ?
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, client_id, name, notes, sort_order, created_at, updated_at
      FROM environments
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO environments (id, client_id, name, notes, sort_order, created_at, updated_at)
      VALUES (@id, @client_id, @name, @notes, @sort_order, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE environments
      SET name = @name, notes = @notes, sort_order = @sort_order, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM environments WHERE id = ?`)
  }

  list(clientId?: string): Environment[] {
    const rows = clientId
      ? (this.listByClientStmt.all(clientId) as EnvironmentRow[])
      : (this.listAllStmt.all() as EnvironmentRow[])
    return rows.map(mapEnvironment)
  }

  get(id: string): Environment | null {
    const row = this.getStmt.get(id) as EnvironmentRow | undefined
    return row ? mapEnvironment(row) : null
  }

  create(input: CreateEnvironmentInput): Environment {
    const now = nowIso()
    const environment: Environment = {
      id: newId(),
      clientId: input.clientId,
      name: input.name,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: environment.id,
      client_id: environment.clientId,
      name: environment.name,
      notes: environment.notes,
      sort_order: environment.sortOrder,
      created_at: environment.createdAt,
      updated_at: environment.updatedAt
    })
    return environment
  }

  update(id: string, input: UpdateEnvironmentInput): Environment | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    const updated: Environment = {
      ...existing,
      name: input.name ?? existing.name,
      notes: input.notes === undefined ? existing.notes : input.notes,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: nowIso()
    }
    this.updateStmt.run({
      id: updated.id,
      name: updated.name,
      notes: updated.notes,
      sort_order: updated.sortOrder,
      updated_at: updated.updatedAt
    })
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }
}
