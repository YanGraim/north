import type { Client, CreateClientInput, UpdateClientInput } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type ClientRow = {
  id: string
  name: string
  notes: string | null
  color: string | null
  created_at: string
  updated_at: string
}

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ClientsRepository {
  private readonly listStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listStmt = db.prepare(`
      SELECT id, name, notes, color, created_at, updated_at
      FROM clients
      ORDER BY name COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, name, notes, color, created_at, updated_at
      FROM clients
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO clients (id, name, notes, color, created_at, updated_at)
      VALUES (@id, @name, @notes, @color, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE clients
      SET name = @name, notes = @notes, color = @color, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM clients WHERE id = ?`)
  }

  list(): Client[] {
    return (this.listStmt.all() as ClientRow[]).map(mapClient)
  }

  get(id: string): Client | null {
    const row = this.getStmt.get(id) as ClientRow | undefined
    return row ? mapClient(row) : null
  }

  create(input: CreateClientInput): Client {
    const now = nowIso()
    const client: Client = {
      id: newId(),
      name: input.name,
      notes: input.notes ?? null,
      color: input.color ?? null,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: client.id,
      name: client.name,
      notes: client.notes,
      color: client.color,
      created_at: client.createdAt,
      updated_at: client.updatedAt
    })
    return client
  }

  update(id: string, input: UpdateClientInput): Client | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    const updated: Client = {
      ...existing,
      name: input.name ?? existing.name,
      notes: input.notes === undefined ? existing.notes : input.notes,
      color: input.color === undefined ? existing.color : input.color,
      updatedAt: nowIso()
    }
    this.updateStmt.run({
      id: updated.id,
      name: updated.name,
      notes: updated.notes,
      color: updated.color,
      updated_at: updated.updatedAt
    })
    return updated
  }

  /** Cascades to environments → groups → connections via FK. */
  delete(id: string): boolean {
    const result = this.deleteStmt.run(id)
    return result.changes > 0
  }
}
