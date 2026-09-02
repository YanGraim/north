import type {
  ApiRequest,
  ApiRequestDefinition,
  CreateApiRequestInput,
  MoveApiRequestInput,
  UpdateApiRequestInput
} from '@shared/types'
import { ApiRequestDefinitionSchema, emptyApiRequestDefinition } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type RequestRow = {
  id: string
  collection_id: string
  folder_id: string | null
  name: string
  method: ApiRequest['method']
  url: string
  definition: string
  sort_order: number
  created_at: string
  updated_at: string
}

function parseDefinition(raw: string): ApiRequestDefinition {
  try {
    return ApiRequestDefinitionSchema.parse(JSON.parse(raw))
  } catch {
    return emptyApiRequestDefinition()
  }
}

function mapRequest(row: RequestRow): ApiRequest {
  return {
    id: row.id,
    collectionId: row.collection_id,
    folderId: row.folder_id,
    name: row.name,
    method: row.method,
    url: row.url,
    definition: parseDefinition(row.definition),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ApiRequestsRepository {
  private readonly listByCollectionStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt
  private readonly maxSortStmt

  constructor(db: SqliteDatabase) {
    this.listByCollectionStmt = db.prepare(`
      SELECT id, collection_id, folder_id, name, method, url, definition, sort_order,
             created_at, updated_at
      FROM api_requests
      WHERE collection_id = ?
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, collection_id, folder_id, name, method, url, definition, sort_order,
             created_at, updated_at
      FROM api_requests
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO api_requests (
        id, collection_id, folder_id, name, method, url, definition, sort_order,
        created_at, updated_at
      ) VALUES (
        @id, @collection_id, @folder_id, @name, @method, @url, @definition, @sort_order,
        @created_at, @updated_at
      )
    `)
    this.updateStmt = db.prepare(`
      UPDATE api_requests
      SET collection_id = @collection_id,
          folder_id = @folder_id,
          name = @name,
          method = @method,
          url = @url,
          definition = @definition,
          sort_order = @sort_order,
          updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM api_requests WHERE id = ?`)
    this.maxSortStmt = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) AS max_sort
      FROM api_requests
      WHERE collection_id = ? AND IFNULL(folder_id, '') = IFNULL(?, '')
    `)
  }

  listByCollection(collectionId: string): ApiRequest[] {
    return (this.listByCollectionStmt.all(collectionId) as RequestRow[]).map(mapRequest)
  }

  get(id: string): ApiRequest | null {
    const row = this.getStmt.get(id) as RequestRow | undefined
    return row ? mapRequest(row) : null
  }

  create(input: CreateApiRequestInput): ApiRequest {
    const now = nowIso()
    const folderId = input.folderId ?? null
    const maxSort = (this.maxSortStmt.get(input.collectionId, folderId) as { max_sort: number })
      .max_sort
    const request: ApiRequest = {
      id: newId(),
      collectionId: input.collectionId,
      folderId,
      name: input.name,
      method: input.method ?? 'GET',
      url: input.url ?? '',
      definition: input.definition ?? emptyApiRequestDefinition(),
      sortOrder: input.sortOrder ?? maxSort + 1,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: request.id,
      collection_id: request.collectionId,
      folder_id: request.folderId,
      name: request.name,
      method: request.method,
      url: request.url,
      definition: JSON.stringify(request.definition),
      sort_order: request.sortOrder,
      created_at: request.createdAt,
      updated_at: request.updatedAt
    })
    return request
  }

  update(id: string, input: UpdateApiRequestInput): ApiRequest | null {
    const existing = this.get(id)
    if (!existing) return null
    const updated: ApiRequest = {
      ...existing,
      collectionId: input.collectionId ?? existing.collectionId,
      folderId: input.folderId === undefined ? existing.folderId : input.folderId,
      name: input.name ?? existing.name,
      method: input.method ?? existing.method,
      url: input.url === undefined ? existing.url : input.url,
      definition: input.definition ?? existing.definition,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: nowIso()
    }
    this.updateStmt.run({
      id: updated.id,
      collection_id: updated.collectionId,
      folder_id: updated.folderId,
      name: updated.name,
      method: updated.method,
      url: updated.url,
      definition: JSON.stringify(updated.definition),
      sort_order: updated.sortOrder,
      updated_at: updated.updatedAt
    })
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }

  duplicate(id: string): ApiRequest | null {
    const existing = this.get(id)
    if (!existing) return null
    return this.create({
      collectionId: existing.collectionId,
      folderId: existing.folderId,
      name: `${existing.name} (cópia)`,
      method: existing.method,
      url: existing.url,
      definition: structuredClone(existing.definition)
    })
  }

  move(input: MoveApiRequestInput): ApiRequest | null {
    return this.update(input.requestId, {
      collectionId: input.collectionId,
      folderId: input.folderId,
      sortOrder: input.sortOrder
    })
  }
}
