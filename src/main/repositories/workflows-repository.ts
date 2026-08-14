import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  Workflow,
  WorkflowDefinition
} from '@shared/types'
import { emptyWorkflowDefinition, WorkflowDefinitionSchema } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type WorkflowRow = {
  id: string
  group_id: string
  name: string
  description: string | null
  icon: string | null
  preferred_connection_id: string | null
  sort_order: number
  definition: string
  created_at: string
  updated_at: string
}

function parseDefinition(raw: string): WorkflowDefinition {
  try {
    return WorkflowDefinitionSchema.parse(JSON.parse(raw))
  } catch {
    return emptyWorkflowDefinition()
  }
}

function mapWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    preferredConnectionId: row.preferred_connection_id,
    sortOrder: row.sort_order,
    definition: parseDefinition(row.definition),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class WorkflowsRepository {
  private readonly listByGroupStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listByGroupStmt = db.prepare(`
      SELECT id, group_id, name, description, icon, preferred_connection_id,
             sort_order, definition, created_at, updated_at
      FROM workflows
      WHERE group_id = ?
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, group_id, name, description, icon, preferred_connection_id,
             sort_order, definition, created_at, updated_at
      FROM workflows
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO workflows (
        id, group_id, name, description, icon, preferred_connection_id,
        sort_order, definition, created_at, updated_at
      ) VALUES (
        @id, @group_id, @name, @description, @icon, @preferred_connection_id,
        @sort_order, @definition, @created_at, @updated_at
      )
    `)
    this.updateStmt = db.prepare(`
      UPDATE workflows
      SET group_id = @group_id,
          name = @name,
          description = @description,
          icon = @icon,
          preferred_connection_id = @preferred_connection_id,
          sort_order = @sort_order,
          definition = @definition,
          updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM workflows WHERE id = ?`)
  }

  listByGroup(groupId: string): Workflow[] {
    return (this.listByGroupStmt.all(groupId) as WorkflowRow[]).map(mapWorkflow)
  }

  get(id: string): Workflow | null {
    const row = this.getStmt.get(id) as WorkflowRow | undefined
    return row ? mapWorkflow(row) : null
  }

  create(input: CreateWorkflowInput): Workflow {
    const now = nowIso()
    const definition = input.definition ?? emptyWorkflowDefinition()
    const workflow: Workflow = {
      id: newId(),
      groupId: input.groupId,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      preferredConnectionId: input.preferredConnectionId ?? null,
      sortOrder: input.sortOrder ?? 0,
      definition,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: workflow.id,
      group_id: workflow.groupId,
      name: workflow.name,
      description: workflow.description,
      icon: workflow.icon,
      preferred_connection_id: workflow.preferredConnectionId,
      sort_order: workflow.sortOrder,
      definition: JSON.stringify(workflow.definition),
      created_at: workflow.createdAt,
      updated_at: workflow.updatedAt
    })
    return workflow
  }

  update(id: string, input: UpdateWorkflowInput): Workflow | null {
    const existing = this.get(id)
    if (!existing) return null
    const updated: Workflow = {
      ...existing,
      groupId: input.groupId ?? existing.groupId,
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      icon: input.icon === undefined ? existing.icon : input.icon,
      preferredConnectionId:
        input.preferredConnectionId === undefined
          ? existing.preferredConnectionId
          : input.preferredConnectionId,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      definition: input.definition ?? existing.definition,
      updatedAt: nowIso()
    }
    this.updateStmt.run({
      id: updated.id,
      group_id: updated.groupId,
      name: updated.name,
      description: updated.description,
      icon: updated.icon,
      preferred_connection_id: updated.preferredConnectionId,
      sort_order: updated.sortOrder,
      definition: JSON.stringify(updated.definition),
      updated_at: updated.updatedAt
    })
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }
}
