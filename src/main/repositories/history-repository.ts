import type {
  ConnectionHistoryEntry,
  ListHistoryFilter,
  RecordAccessInput,
  RecordConnectionInput
} from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { boolToInt, intToBool, newId, nowIso } from './row-utils'

type HistoryRow = {
  id: string
  connection_id: string | null
  access_id: string | null
  connected_at: string
  duration_ms: number | null
  success: number
  error_message: string | null
}

function mapHistory(row: HistoryRow): ConnectionHistoryEntry {
  return {
    id: row.id,
    connectionId: row.connection_id,
    accessId: row.access_id,
    connectedAt: row.connected_at,
    durationMs: row.duration_ms,
    success: intToBool(row.success),
    errorMessage: row.error_message
  }
}

export class HistoryRepository {
  private readonly listAllStmt
  private readonly listByConnectionStmt
  private readonly listByAccessStmt
  private readonly insertConnectionStmt
  private readonly insertAccessStmt
  private readonly bumpConnectionStmt

  constructor(private readonly db: SqliteDatabase) {
    this.listAllStmt = db.prepare(`
      SELECT id, connection_id, NULL AS access_id, connected_at, duration_ms, success, error_message
      FROM connection_history
      UNION ALL
      SELECT id, NULL AS connection_id, access_id, connected_at, duration_ms, success, error_message
      FROM access_history
      ORDER BY connected_at DESC
      LIMIT ?
    `)
    this.listByConnectionStmt = db.prepare(`
      SELECT id, connection_id, NULL AS access_id, connected_at, duration_ms, success, error_message
      FROM connection_history
      WHERE connection_id = ?
      ORDER BY connected_at DESC
      LIMIT ?
    `)
    this.listByAccessStmt = db.prepare(`
      SELECT id, NULL AS connection_id, access_id, connected_at, duration_ms, success, error_message
      FROM access_history
      WHERE access_id = ?
      ORDER BY connected_at DESC
      LIMIT ?
    `)
    this.insertConnectionStmt = db.prepare(`
      INSERT INTO connection_history (
        id, connection_id, connected_at, duration_ms, success, error_message
      ) VALUES (@id, @connection_id, @connected_at, @duration_ms, @success, @error_message)
    `)
    this.insertAccessStmt = db.prepare(`
      INSERT INTO access_history (
        id, access_id, connected_at, duration_ms, success, error_message
      ) VALUES (@id, @access_id, @connected_at, @duration_ms, @success, @error_message)
    `)
    this.bumpConnectionStmt = db.prepare(`
      UPDATE connections
      SET access_count = access_count + 1,
          total_connected_ms = total_connected_ms + @duration_ms,
          last_connected_at = @connected_at,
          updated_at = @updated_at
      WHERE id = @id
    `)
  }

  list(filter: ListHistoryFilter = {}): ConnectionHistoryEntry[] {
    const limit = filter.limit ?? 100
    if (filter.accessId) {
      return (this.listByAccessStmt.all(filter.accessId, limit) as HistoryRow[]).map(mapHistory)
    }
    if (filter.connectionId) {
      return (this.listByConnectionStmt.all(filter.connectionId, limit) as HistoryRow[]).map(
        mapHistory
      )
    }
    return (this.listAllStmt.all(limit) as HistoryRow[]).map(mapHistory)
  }

  /**
   * Inserts a history row and, on success, increments accessCount,
   * accumulates duration, and updates lastConnectedAt — all in one transaction.
   */
  record(input: RecordConnectionInput): ConnectionHistoryEntry {
    const connectedAt = input.connectedAt ?? nowIso()
    const durationMs = input.durationMs ?? null
    const entry: ConnectionHistoryEntry = {
      id: newId(),
      connectionId: input.connectionId,
      accessId: null,
      connectedAt,
      durationMs,
      success: input.success,
      errorMessage: input.errorMessage ?? null
    }

    const apply = this.db.transaction(() => {
      this.insertConnectionStmt.run({
        id: entry.id,
        connection_id: entry.connectionId,
        connected_at: entry.connectedAt,
        duration_ms: entry.durationMs,
        success: boolToInt(entry.success),
        error_message: entry.errorMessage
      })

      if (entry.success && entry.connectionId) {
        this.bumpConnectionStmt.run({
          id: entry.connectionId,
          duration_ms: entry.durationMs ?? 0,
          connected_at: entry.connectedAt,
          updated_at: nowIso()
        })
      }
    })

    apply()
    return entry
  }

  recordAccess(input: RecordAccessInput): ConnectionHistoryEntry {
    const connectedAt = input.connectedAt ?? nowIso()
    const durationMs = input.durationMs ?? null
    const entry: ConnectionHistoryEntry = {
      id: newId(),
      connectionId: null,
      accessId: input.accessId,
      connectedAt,
      durationMs,
      success: input.success,
      errorMessage: input.errorMessage ?? null
    }

    this.insertAccessStmt.run({
      id: entry.id,
      access_id: entry.accessId,
      connected_at: entry.connectedAt,
      duration_ms: entry.durationMs,
      success: boolToInt(entry.success),
      error_message: entry.errorMessage
    })

    return entry
  }
}
