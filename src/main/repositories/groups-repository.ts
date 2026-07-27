import type { CreateGroupInput, Group, UpdateGroupInput } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type GroupRow = {
  id: string
  environment_id: string
  name: string
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    environmentId: row.environment_id,
    name: row.name,
    notes: row.notes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class GroupsRepository {
  private readonly listAllStmt
  private readonly listByEnvironmentStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listAllStmt = db.prepare(`
      SELECT id, environment_id, name, notes, sort_order, created_at, updated_at
      FROM groups
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.listByEnvironmentStmt = db.prepare(`
      SELECT id, environment_id, name, notes, sort_order, created_at, updated_at
      FROM groups
      WHERE environment_id = ?
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, environment_id, name, notes, sort_order, created_at, updated_at
      FROM groups
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO groups (id, environment_id, name, notes, sort_order, created_at, updated_at)
      VALUES (@id, @environment_id, @name, @notes, @sort_order, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE groups
      SET name = @name, notes = @notes, sort_order = @sort_order, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM groups WHERE id = ?`)
  }

  list(environmentId?: string): Group[] {
    const rows = environmentId
      ? (this.listByEnvironmentStmt.all(environmentId) as GroupRow[])
      : (this.listAllStmt.all() as GroupRow[])
    return rows.map(mapGroup)
  }

  get(id: string): Group | null {
    const row = this.getStmt.get(id) as GroupRow | undefined
    return row ? mapGroup(row) : null
  }

  create(input: CreateGroupInput): Group {
    const now = nowIso()
    const group: Group = {
      id: newId(),
      environmentId: input.environmentId,
      name: input.name,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: group.id,
      environment_id: group.environmentId,
      name: group.name,
      notes: group.notes,
      sort_order: group.sortOrder,
      created_at: group.createdAt,
      updated_at: group.updatedAt
    })
    return group
  }

  update(id: string, input: UpdateGroupInput): Group | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    const updated: Group = {
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
