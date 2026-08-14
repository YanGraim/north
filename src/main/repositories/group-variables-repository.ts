import type {
  CreateGroupVariableInput,
  GroupVariable,
  UpdateGroupVariableInput
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type GroupVariableRow = {
  id: string
  group_id: string
  key: string
  value: string
  description: string | null
  created_at: string
  updated_at: string
}

function mapVariable(row: GroupVariableRow): GroupVariable {
  return {
    id: row.id,
    groupId: row.group_id,
    key: row.key,
    value: row.value,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class GroupVariablesRepository {
  private readonly listByGroupStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listByGroupStmt = db.prepare(`
      SELECT id, group_id, key, value, description, created_at, updated_at
      FROM group_variables
      WHERE group_id = ?
      ORDER BY key COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, group_id, key, value, description, created_at, updated_at
      FROM group_variables
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO group_variables (id, group_id, key, value, description, created_at, updated_at)
      VALUES (@id, @group_id, @key, @value, @description, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE group_variables
      SET key = @key, value = @value, description = @description, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM group_variables WHERE id = ?`)
  }

  listByGroup(groupId: string): GroupVariable[] {
    return (this.listByGroupStmt.all(groupId) as GroupVariableRow[]).map(mapVariable)
  }

  get(id: string): GroupVariable | null {
    const row = this.getStmt.get(id) as GroupVariableRow | undefined
    return row ? mapVariable(row) : null
  }

  create(input: CreateGroupVariableInput): GroupVariable {
    const now = nowIso()
    const variable: GroupVariable = {
      id: newId(),
      groupId: input.groupId,
      key: input.key,
      value: input.value,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: variable.id,
      group_id: variable.groupId,
      key: variable.key,
      value: variable.value,
      description: variable.description,
      created_at: variable.createdAt,
      updated_at: variable.updatedAt
    })
    return variable
  }

  update(id: string, input: UpdateGroupVariableInput): GroupVariable | null {
    const existing = this.get(id)
    if (!existing) return null
    const updated: GroupVariable = {
      ...existing,
      key: input.key ?? existing.key,
      value: input.value ?? existing.value,
      description: input.description === undefined ? existing.description : input.description,
      updatedAt: nowIso()
    }
    this.updateStmt.run({
      id: updated.id,
      key: updated.key,
      value: updated.value,
      description: updated.description,
      updated_at: updated.updatedAt
    })
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }

  toRecord(groupId: string): Record<string, string> {
    const record: Record<string, string> = {}
    for (const variable of this.listByGroup(groupId)) {
      record[variable.key] = variable.value
    }
    return record
  }
}
