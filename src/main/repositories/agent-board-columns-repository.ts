import type {
  AgentBoardColumn,
  CreateAgentBoardColumnInput,
  UpdateAgentBoardColumnInput
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type ColumnRow = {
  id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

function mapColumn(row: ColumnRow): AgentBoardColumn {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class AgentBoardColumnsRepository {
  private readonly listStmt
  private readonly getStmt
  private readonly maxSortOrderStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listStmt = db.prepare(`
      SELECT id, name, sort_order, created_at, updated_at
      FROM agent_board_columns
      ORDER BY sort_order ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, name, sort_order, created_at, updated_at
      FROM agent_board_columns
      WHERE id = ?
    `)
    this.maxSortOrderStmt = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM agent_board_columns
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO agent_board_columns (id, name, sort_order, created_at, updated_at)
      VALUES (@id, @name, @sort_order, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE agent_board_columns SET name = @name, updated_at = @updated_at WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM agent_board_columns WHERE id = ?`)
  }

  list(): AgentBoardColumn[] {
    return (this.listStmt.all() as ColumnRow[]).map(mapColumn)
  }

  get(id: string): AgentBoardColumn | null {
    const row = this.getStmt.get(id) as ColumnRow | undefined
    return row ? mapColumn(row) : null
  }

  create(input: CreateAgentBoardColumnInput): AgentBoardColumn {
    const now = nowIso()
    const { max_order } = this.maxSortOrderStmt.get() as { max_order: number }
    const column: AgentBoardColumn = {
      id: newId(),
      name: input.name,
      sortOrder: max_order + 1,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: column.id,
      name: column.name,
      sort_order: column.sortOrder,
      created_at: column.createdAt,
      updated_at: column.updatedAt
    })
    return column
  }

  update(id: string, input: UpdateAgentBoardColumnInput): AgentBoardColumn | null {
    const existing = this.get(id)
    if (!existing) return null
    const updated: AgentBoardColumn = { ...existing, name: input.name, updatedAt: nowIso() }
    this.updateStmt.run({ id: updated.id, name: updated.name, updated_at: updated.updatedAt })
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }
}
