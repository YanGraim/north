import type { VpnErrorCode, VpnHistoryEntry, VpnTrigger } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

type VpnHistoryRow = {
  id: string
  vpn_profile_id: string
  started_at: string
  ended_at: string | null
  trigger: VpnTrigger
  result: VpnHistoryEntry['result']
  error_code: VpnErrorCode | null
}

export class VpnHistoryRepository {
  private readonly insertStmt
  private readonly finishStmt
  private readonly listStmt

  constructor(db: SqliteDatabase) {
    this.insertStmt = db.prepare(`
      INSERT INTO vpn_history (id, vpn_profile_id, started_at, trigger, result)
      VALUES (?, ?, ?, ?, 'pending')
    `)
    this.finishStmt = db.prepare(
      `UPDATE vpn_history SET ended_at = ?, result = ?, error_code = ? WHERE id = ?`
    )
    this.listStmt = db.prepare(`
      SELECT id, vpn_profile_id, started_at, ended_at, trigger, result, error_code
      FROM vpn_history WHERE vpn_profile_id = ? ORDER BY started_at DESC LIMIT ?
    `)
  }

  start(profileId: string, trigger: VpnTrigger): string {
    const id = newId()
    this.insertStmt.run(id, profileId, nowIso(), trigger)
    return id
  }

  finish(
    id: string,
    result: VpnHistoryEntry['result'],
    errorCode: VpnErrorCode | null = null
  ): void {
    this.finishStmt.run(nowIso(), result, errorCode, id)
  }

  listByProfile(profileId: string, limit = 100): VpnHistoryEntry[] {
    return (this.listStmt.all(profileId, limit) as VpnHistoryRow[]).map((r) => ({
      id: r.id,
      vpnProfileId: r.vpn_profile_id,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      trigger: r.trigger,
      result: r.result,
      errorCode: r.error_code
    }))
  }
}
