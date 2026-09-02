import type { ApiRequestHistoryEntry, InsertApiRequestHistoryInput } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type HistoryRow = {
  id: string
  access_id: string
  request_id: string | null
  method: ApiRequestHistoryEntry['method']
  url: string
  status_code: number | null
  duration_ms: number | null
  size_bytes: number | null
  error_kind: string | null
  error_message: string | null
  executed_at: string
}

function mapEntry(row: HistoryRow): ApiRequestHistoryEntry {
  return {
    id: row.id,
    accessId: row.access_id,
    requestId: row.request_id,
    method: row.method,
    url: row.url,
    statusCode: row.status_code,
    durationMs: row.duration_ms,
    sizeBytes: row.size_bytes,
    errorKind: row.error_kind,
    errorMessage: row.error_message,
    executedAt: row.executed_at
  }
}

export class ApiRequestHistoryRepository {
  private readonly listByAccessStmt
  private readonly insertStmt

  constructor(db: SqliteDatabase) {
    this.listByAccessStmt = db.prepare(`
      SELECT id, access_id, request_id, method, url, status_code, duration_ms, size_bytes,
             error_kind, error_message, executed_at
      FROM api_request_history
      WHERE access_id = ?
      ORDER BY executed_at DESC
      LIMIT ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO api_request_history (
        id, access_id, request_id, method, url, status_code, duration_ms, size_bytes,
        error_kind, error_message, executed_at
      ) VALUES (
        @id, @access_id, @request_id, @method, @url, @status_code, @duration_ms, @size_bytes,
        @error_kind, @error_message, @executed_at
      )
    `)
  }

  listByAccess(accessId: string, limit = 50): ApiRequestHistoryEntry[] {
    return (this.listByAccessStmt.all(accessId, limit) as HistoryRow[]).map(mapEntry)
  }

  insert(input: InsertApiRequestHistoryInput): ApiRequestHistoryEntry {
    const entry: ApiRequestHistoryEntry = {
      id: newId(),
      accessId: input.accessId,
      requestId: input.requestId ?? null,
      method: input.method,
      url: input.url,
      statusCode: input.statusCode ?? null,
      durationMs: input.durationMs ?? null,
      sizeBytes: input.sizeBytes ?? null,
      errorKind: input.errorKind ?? null,
      errorMessage: input.errorMessage ?? null,
      executedAt: nowIso()
    }
    this.insertStmt.run({
      id: entry.id,
      access_id: entry.accessId,
      request_id: entry.requestId,
      method: entry.method,
      url: entry.url,
      status_code: entry.statusCode,
      duration_ms: entry.durationMs,
      size_bytes: entry.sizeBytes,
      error_kind: entry.errorKind,
      error_message: entry.errorMessage,
      executed_at: entry.executedAt
    })
    return entry
  }
}
