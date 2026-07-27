import type {
  CreateTagInput,
  SetAccessTagsInput,
  SetConnectionTagsInput,
  Tag,
  UpdateTagInput
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId } from './row-utils'

type TagRow = {
  id: string
  name: string
  color: string | null
}

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color
  }
}

export class TagsRepository {
  private readonly listStmt
  private readonly getStmt
  private readonly listForConnectionStmt
  private readonly listForAccessStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt
  private readonly clearConnectionTagsStmt
  private readonly insertConnectionTagStmt
  private readonly clearAccessTagsStmt
  private readonly insertAccessTagStmt

  constructor(private readonly db: SqliteDatabase) {
    this.listStmt = db.prepare(`
      SELECT id, name, color
      FROM tags
      ORDER BY name COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`SELECT id, name, color FROM tags WHERE id = ?`)
    this.listForConnectionStmt = db.prepare(`
      SELECT t.id, t.name, t.color
      FROM tags t
      INNER JOIN connection_tags ct ON ct.tag_id = t.id
      WHERE ct.connection_id = ?
      ORDER BY t.name COLLATE NOCASE ASC
    `)
    this.listForAccessStmt = db.prepare(`
      SELECT t.id, t.name, t.color
      FROM tags t
      INNER JOIN access_tags at ON at.tag_id = t.id
      WHERE at.access_id = ?
      ORDER BY t.name COLLATE NOCASE ASC
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO tags (id, name, color)
      VALUES (@id, @name, @color)
    `)
    this.updateStmt = db.prepare(`
      UPDATE tags SET name = @name, color = @color WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM tags WHERE id = ?`)
    this.clearConnectionTagsStmt = db.prepare(`
      DELETE FROM connection_tags WHERE connection_id = ?
    `)
    this.insertConnectionTagStmt = db.prepare(`
      INSERT INTO connection_tags (connection_id, tag_id)
      VALUES (?, ?)
    `)
    this.clearAccessTagsStmt = db.prepare(`
      DELETE FROM access_tags WHERE access_id = ?
    `)
    this.insertAccessTagStmt = db.prepare(`
      INSERT INTO access_tags (access_id, tag_id)
      VALUES (?, ?)
    `)
  }

  list(): Tag[] {
    return (this.listStmt.all() as TagRow[]).map(mapTag)
  }

  get(id: string): Tag | null {
    const row = this.getStmt.get(id) as TagRow | undefined
    return row ? mapTag(row) : null
  }

  listForConnection(connectionId: string): Tag[] {
    return (this.listForConnectionStmt.all(connectionId) as TagRow[]).map(mapTag)
  }

  listForAccess(accessId: string): Tag[] {
    return (this.listForAccessStmt.all(accessId) as TagRow[]).map(mapTag)
  }

  create(input: CreateTagInput): Tag {
    const tag: Tag = {
      id: newId(),
      name: input.name,
      color: input.color ?? null
    }
    this.insertStmt.run({
      id: tag.id,
      name: tag.name,
      color: tag.color
    })
    return tag
  }

  update(id: string, input: UpdateTagInput): Tag | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }
    const updated: Tag = {
      ...existing,
      name: input.name ?? existing.name,
      color: input.color === undefined ? existing.color : input.color
    }
    this.updateStmt.run({
      id: updated.id,
      name: updated.name,
      color: updated.color
    })
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }

  setForConnection(input: SetConnectionTagsInput): Tag[] {
    const apply = this.db.transaction(() => {
      this.clearConnectionTagsStmt.run(input.connectionId)
      for (const tagId of input.tagIds) {
        this.insertConnectionTagStmt.run(input.connectionId, tagId)
      }
    })
    apply()
    return this.listForConnection(input.connectionId)
  }

  setForAccess(input: SetAccessTagsInput): Tag[] {
    const apply = this.db.transaction(() => {
      this.clearAccessTagsStmt.run(input.accessId)
      for (const tagId of input.tagIds) {
        this.insertAccessTagStmt.run(input.accessId, tagId)
      }
    })
    apply()
    return this.listForAccess(input.accessId)
  }
}
