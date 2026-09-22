import type { ConnectionHealthStatus, ConnectionMonitor } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { boolToInt, intToBool, nowIso } from './row-utils'

type ConnectionMonitorRow = {
  connection_id: string
  enabled: number
  last_status: ConnectionHealthStatus | null
  last_checked_at: string | null
}

function mapMonitor(row: ConnectionMonitorRow): ConnectionMonitor {
  return {
    connectionId: row.connection_id,
    enabled: intToBool(row.enabled),
    lastStatus: row.last_status,
    lastCheckedAt: row.last_checked_at
  }
}

export class ConnectionMonitorsRepository {
  private readonly getStmt
  private readonly listEnabledStmt
  private readonly upsertEnabledStmt
  private readonly updateStatusStmt

  constructor(db: SqliteDatabase) {
    this.getStmt = db.prepare(`
      SELECT connection_id, enabled, last_status, last_checked_at
      FROM connection_monitors
      WHERE connection_id = ?
    `)
    this.listEnabledStmt = db.prepare(`
      SELECT connection_id, enabled, last_status, last_checked_at
      FROM connection_monitors
      WHERE enabled = 1
    `)
    this.upsertEnabledStmt = db.prepare(`
      INSERT INTO connection_monitors (connection_id, enabled, updated_at)
      VALUES (@connection_id, @enabled, @updated_at)
      ON CONFLICT(connection_id) DO UPDATE SET enabled = @enabled, updated_at = @updated_at
    `)
    this.updateStatusStmt = db.prepare(`
      UPDATE connection_monitors
      SET last_status = @last_status, last_checked_at = @last_checked_at, updated_at = @updated_at
      WHERE connection_id = @connection_id
    `)
  }

  get(connectionId: string): ConnectionMonitor | null {
    const row = this.getStmt.get(connectionId) as ConnectionMonitorRow | undefined
    return row ? mapMonitor(row) : null
  }

  listEnabled(): ConnectionMonitor[] {
    return (this.listEnabledStmt.all() as ConnectionMonitorRow[]).map(mapMonitor)
  }

  setEnabled(connectionId: string, enabled: boolean): ConnectionMonitor {
    this.upsertEnabledStmt.run({
      connection_id: connectionId,
      enabled: boolToInt(enabled),
      updated_at: nowIso()
    })
    return this.get(connectionId) as ConnectionMonitor
  }

  recordStatus(connectionId: string, status: ConnectionHealthStatus): void {
    this.updateStatusStmt.run({
      connection_id: connectionId,
      last_status: status,
      last_checked_at: nowIso(),
      updated_at: nowIso()
    })
  }
}
