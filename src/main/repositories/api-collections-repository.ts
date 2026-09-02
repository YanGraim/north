import type {
  ApiCollection,
  ApiFolder,
  CreateApiCollectionInput,
  CreateApiFolderInput,
  UpdateApiCollectionInput,
  UpdateApiFolderInput
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type CollectionRow = {
  id: string
  client_id: string | null
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

type FolderRow = {
  id: string
  collection_id: string
  parent_folder_id: string | null
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

function mapCollection(row: CollectionRow): ApiCollection {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapFolder(row: FolderRow): ApiFolder {
  return {
    id: row.id,
    collectionId: row.collection_id,
    parentFolderId: row.parent_folder_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ApiCollectionsRepository {
  private readonly listAllStmt
  private readonly listByClientStmt
  private readonly getCollectionStmt
  private readonly insertCollectionStmt
  private readonly updateCollectionStmt
  private readonly deleteCollectionStmt
  private readonly maxCollectionSortStmt
  private readonly listFoldersStmt
  private readonly getFolderStmt
  private readonly insertFolderStmt
  private readonly updateFolderStmt
  private readonly deleteFolderStmt
  private readonly maxFolderSortStmt

  constructor(db: SqliteDatabase) {
    this.listAllStmt = db.prepare(`
      SELECT id, client_id, name, description, sort_order, created_at, updated_at
      FROM api_collections
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.listByClientStmt = db.prepare(`
      SELECT id, client_id, name, description, sort_order, created_at, updated_at
      FROM api_collections
      WHERE IFNULL(client_id, '') = IFNULL(?, '')
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.getCollectionStmt = db.prepare(`
      SELECT id, client_id, name, description, sort_order, created_at, updated_at
      FROM api_collections
      WHERE id = ?
    `)
    this.insertCollectionStmt = db.prepare(`
      INSERT INTO api_collections (
        id, client_id, name, description, sort_order, created_at, updated_at
      ) VALUES (
        @id, @client_id, @name, @description, @sort_order, @created_at, @updated_at
      )
    `)
    this.updateCollectionStmt = db.prepare(`
      UPDATE api_collections
      SET name = @name, description = @description, sort_order = @sort_order, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteCollectionStmt = db.prepare(`DELETE FROM api_collections WHERE id = ?`)
    this.maxCollectionSortStmt = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) AS max_sort
      FROM api_collections
      WHERE IFNULL(client_id, '') = IFNULL(?, '')
    `)

    this.listFoldersStmt = db.prepare(`
      SELECT id, collection_id, parent_folder_id, name, sort_order, created_at, updated_at
      FROM api_folders
      WHERE collection_id = ?
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `)
    this.getFolderStmt = db.prepare(`
      SELECT id, collection_id, parent_folder_id, name, sort_order, created_at, updated_at
      FROM api_folders
      WHERE id = ?
    `)
    this.insertFolderStmt = db.prepare(`
      INSERT INTO api_folders (
        id, collection_id, parent_folder_id, name, sort_order, created_at, updated_at
      ) VALUES (
        @id, @collection_id, @parent_folder_id, @name, @sort_order, @created_at, @updated_at
      )
    `)
    this.updateFolderStmt = db.prepare(`
      UPDATE api_folders
      SET name = @name, parent_folder_id = @parent_folder_id, sort_order = @sort_order,
          updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteFolderStmt = db.prepare(`DELETE FROM api_folders WHERE id = ?`)
    this.maxFolderSortStmt = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) AS max_sort
      FROM api_folders
      WHERE collection_id = ? AND IFNULL(parent_folder_id, '') = IFNULL(?, '')
    `)
  }

  listAll(): ApiCollection[] {
    return (this.listAllStmt.all() as CollectionRow[]).map(mapCollection)
  }

  listByClient(clientId: string | null): ApiCollection[] {
    return (this.listByClientStmt.all(clientId) as CollectionRow[]).map(mapCollection)
  }

  getCollection(id: string): ApiCollection | null {
    const row = this.getCollectionStmt.get(id) as CollectionRow | undefined
    return row ? mapCollection(row) : null
  }

  createCollection(input: CreateApiCollectionInput): ApiCollection {
    const now = nowIso()
    const maxSort = (this.maxCollectionSortStmt.get(input.clientId) as { max_sort: number })
      .max_sort
    const collection: ApiCollection = {
      id: newId(),
      clientId: input.clientId,
      name: input.name,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? maxSort + 1,
      createdAt: now,
      updatedAt: now
    }
    this.insertCollectionStmt.run({
      id: collection.id,
      client_id: collection.clientId,
      name: collection.name,
      description: collection.description,
      sort_order: collection.sortOrder,
      created_at: collection.createdAt,
      updated_at: collection.updatedAt
    })
    return collection
  }

  updateCollection(id: string, input: UpdateApiCollectionInput): ApiCollection | null {
    const existing = this.getCollection(id)
    if (!existing) return null
    const updated: ApiCollection = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: nowIso()
    }
    this.updateCollectionStmt.run({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      sort_order: updated.sortOrder,
      updated_at: updated.updatedAt
    })
    return updated
  }

  deleteCollection(id: string): boolean {
    return this.deleteCollectionStmt.run(id).changes > 0
  }

  listFolders(collectionId: string): ApiFolder[] {
    return (this.listFoldersStmt.all(collectionId) as FolderRow[]).map(mapFolder)
  }

  getFolder(id: string): ApiFolder | null {
    const row = this.getFolderStmt.get(id) as FolderRow | undefined
    return row ? mapFolder(row) : null
  }

  createFolder(input: CreateApiFolderInput): ApiFolder {
    const now = nowIso()
    const parentId = input.parentFolderId ?? null
    const maxSort = (
      this.maxFolderSortStmt.get(input.collectionId, parentId) as { max_sort: number }
    ).max_sort
    const folder: ApiFolder = {
      id: newId(),
      collectionId: input.collectionId,
      parentFolderId: parentId,
      name: input.name,
      sortOrder: input.sortOrder ?? maxSort + 1,
      createdAt: now,
      updatedAt: now
    }
    this.insertFolderStmt.run({
      id: folder.id,
      collection_id: folder.collectionId,
      parent_folder_id: folder.parentFolderId,
      name: folder.name,
      sort_order: folder.sortOrder,
      created_at: folder.createdAt,
      updated_at: folder.updatedAt
    })
    return folder
  }

  updateFolder(id: string, input: UpdateApiFolderInput): ApiFolder | null {
    const existing = this.getFolder(id)
    if (!existing) return null
    const updated: ApiFolder = {
      ...existing,
      name: input.name ?? existing.name,
      parentFolderId:
        input.parentFolderId === undefined ? existing.parentFolderId : input.parentFolderId,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: nowIso()
    }
    this.updateFolderStmt.run({
      id: updated.id,
      name: updated.name,
      parent_folder_id: updated.parentFolderId,
      sort_order: updated.sortOrder,
      updated_at: updated.updatedAt
    })
    return updated
  }

  deleteFolder(id: string): boolean {
    return this.deleteFolderStmt.run(id).changes > 0
  }
}
