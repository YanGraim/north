import { isSafePosixAbsolute } from '@shared/lib/selection-path'
import { normalizeStartupDirectory } from '@shared/lib/startup-directory'
import type { DirectoryFavoriteAddResult } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { newId } from './row-utils'

/**
 * Directory favorites for one connection. Stored beside `connections`, not on
 * the row, so inventory export and connection duplicate do not see them.
 */
export class ConnectionDirectoryFavoritesRepository {
  private readonly listStmt
  private readonly findStmt
  private readonly nextPositionStmt
  private readonly insertStmt
  private readonly deleteStmt
  private readonly deleteAllStmt

  constructor(private readonly db: SqliteDatabase) {
    this.listStmt = db.prepare(`
      SELECT path
      FROM connection_directory_favorites
      WHERE connection_id = ?
      ORDER BY position ASC, path ASC
    `)
    this.findStmt = db.prepare(`
      SELECT path
      FROM connection_directory_favorites
      WHERE connection_id = ? AND path = ?
    `)
    this.nextPositionStmt = db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 AS next
      FROM connection_directory_favorites
      WHERE connection_id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO connection_directory_favorites (id, connection_id, path, position)
      VALUES (@id, @connection_id, @path, @position)
    `)
    this.deleteStmt = db.prepare(`
      DELETE FROM connection_directory_favorites
      WHERE connection_id = ? AND path = ?
    `)
    this.deleteAllStmt = db.prepare(`
      DELETE FROM connection_directory_favorites
      WHERE connection_id = ?
    `)
  }

  list(connectionId: string): string[] {
    const rows = this.listStmt.all(connectionId) as Array<{ path: string }>
    return rows.map((row) => row.path)
  }

  add(connectionId: string, rawPath: string): DirectoryFavoriteAddResult {
    const normalized = normalizeStartupDirectory(rawPath)
    if (!normalized.ok || normalized.value == null || !isSafePosixAbsolute(normalized.value)) {
      return { status: 'invalid' }
    }
    const path = normalized.value
    const created = this.db.transaction(() => {
      const existing = this.findStmt.get(connectionId, path) as { path: string } | undefined
      if (existing) return false
      const position = this.nextPositionStmt.get(connectionId) as { next: number }
      this.insertStmt.run({
        id: newId(),
        connection_id: connectionId,
        path,
        position: position.next
      })
      return true
    })()
    return created ? { status: 'added', path } : { status: 'duplicate', path }
  }

  remove(connectionId: string, rawPath: string): void {
    const normalized = normalizeStartupDirectory(rawPath)
    if (!normalized.ok || normalized.value == null) return
    this.deleteStmt.run(connectionId, normalized.value)
  }

  removeAll(connectionId: string): void {
    this.deleteAllStmt.run(connectionId)
  }
}
