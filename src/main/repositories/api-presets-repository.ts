import type {
  ApiAuth,
  ApiKeyValue,
  ApiPreset,
  CreateApiPresetInput,
  UpdateApiPresetInput
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso, parseJsonArray, toJson } from './row-utils'

type PresetRow = {
  id: string
  name: string
  headers: string
  auth: string | null
  created_at: string
  updated_at: string
}

function mapPreset(row: PresetRow): ApiPreset {
  return {
    id: row.id,
    name: row.name,
    headers: parseJsonArray<ApiKeyValue>(row.headers),
    auth: row.auth ? (JSON.parse(row.auth) as ApiAuth) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ApiPresetsRepository {
  private readonly listStmt
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listStmt = db.prepare(`
      SELECT id, name, headers, auth, created_at, updated_at
      FROM api_presets
      ORDER BY name COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, name, headers, auth, created_at, updated_at
      FROM api_presets
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO api_presets (id, name, headers, auth, created_at, updated_at)
      VALUES (@id, @name, @headers, @auth, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE api_presets
      SET name = @name, headers = @headers, auth = @auth, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM api_presets WHERE id = ?`)
  }

  list(): ApiPreset[] {
    return (this.listStmt.all() as PresetRow[]).map(mapPreset)
  }

  get(id: string): ApiPreset | null {
    const row = this.getStmt.get(id) as PresetRow | undefined
    return row ? mapPreset(row) : null
  }

  create(input: CreateApiPresetInput): ApiPreset {
    const now = nowIso()
    const preset: ApiPreset = {
      id: newId(),
      name: input.name,
      headers: input.headers,
      auth: input.auth,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: preset.id,
      name: preset.name,
      headers: toJson(preset.headers),
      auth: toJson(preset.auth),
      created_at: preset.createdAt,
      updated_at: preset.updatedAt
    })
    return preset
  }

  update(id: string, input: UpdateApiPresetInput): ApiPreset | null {
    const existing = this.get(id)
    if (!existing) return null
    const updated: ApiPreset = {
      ...existing,
      name: input.name ?? existing.name,
      headers: input.headers ?? existing.headers,
      auth: input.auth === undefined ? existing.auth : input.auth,
      updatedAt: nowIso()
    }
    this.updateStmt.run({
      id: updated.id,
      name: updated.name,
      headers: toJson(updated.headers),
      auth: toJson(updated.auth),
      updated_at: updated.updatedAt
    })
    return updated
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }
}
