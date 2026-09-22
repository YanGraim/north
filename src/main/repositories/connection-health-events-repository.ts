import type { ConnectionHealthEvent, ConnectionHealthStatus } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type ConnectionHealthEventRow = {
  id: string
  connection_id: string
  previous_status: ConnectionHealthStatus | null
  new_status: ConnectionHealthStatus
  occurred_at: string
  latency_ms: number | null
  error_message: string | null
}

function mapEvent(row: ConnectionHealthEventRow): ConnectionHealthEvent {
  return {
    id: row.id,
    connectionId: row.connection_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    occurredAt: row.occurred_at,
    latencyMs: row.latency_ms,
    errorMessage: row.error_message
  }
}

export type CreateConnectionHealthEventInput = {
  connectionId: string
  previousStatus: ConnectionHealthStatus | null
  newStatus: ConnectionHealthStatus
  latencyMs?: number | null
  errorMessage?: string | null
}

export class ConnectionHealthEventsRepository {
  private readonly listByConnectionStmt
  private readonly listRecentStmt
  private readonly insertStmt

  constructor(db: SqliteDatabase) {
    this.listByConnectionStmt = db.prepare(`
      SELECT id, connection_id, previous_status, new_status, occurred_at, latency_ms, error_message
      FROM connection_health_events
      WHERE connection_id = ?
      ORDER BY occurred_at DESC, rowid DESC
      LIMIT ?
    `)
    this.listRecentStmt = db.prepare(`
      SELECT id, connection_id, previous_status, new_status, occurred_at, latency_ms, error_message
      FROM connection_health_events
      ORDER BY occurred_at DESC, rowid DESC
      LIMIT ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO connection_health_events
        (id, connection_id, previous_status, new_status, occurred_at, latency_ms, error_message)
      VALUES
        (@id, @connection_id, @previous_status, @new_status, @occurred_at, @latency_ms, @error_message)
    `)
  }

  listByConnection(connectionId: string, limit = 200): ConnectionHealthEvent[] {
    return (this.listByConnectionStmt.all(connectionId, limit) as ConnectionHealthEventRow[]).map(
      mapEvent
    )
  }

  /** Global feed across every connection — powers a Dashboard widget. */
  listRecent(limit = 100): ConnectionHealthEvent[] {
    return (this.listRecentStmt.all(limit) as ConnectionHealthEventRow[]).map(mapEvent)
  }

  create(input: CreateConnectionHealthEventInput): ConnectionHealthEvent {
    const event: ConnectionHealthEvent = {
      id: newId(),
      connectionId: input.connectionId,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      occurredAt: nowIso(),
      latencyMs: input.latencyMs ?? null,
      errorMessage: input.errorMessage ?? null
    }
    this.insertStmt.run({
      id: event.id,
      connection_id: event.connectionId,
      previous_status: event.previousStatus,
      new_status: event.newStatus,
      occurred_at: event.occurredAt,
      latency_ms: event.latencyMs,
      error_message: event.errorMessage
    })
    return event
  }
}
