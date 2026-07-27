import type { SqliteDatabase } from '../database/connection'
import { newId, nowIso } from './row-utils'

export type KnownHost = {
  id: string
  host: string
  port: number
  keyType: string
  fingerprint: string
  publicKey: Buffer
  createdAt: string
  updatedAt: string
}

type KnownHostRow = {
  id: string
  host: string
  port: number
  key_type: string
  fingerprint: string
  public_key: Buffer
  created_at: string
  updated_at: string
}

function mapRow(row: KnownHostRow): KnownHost {
  return {
    id: row.id,
    host: row.host,
    port: row.port,
    keyType: row.key_type,
    fingerprint: row.fingerprint,
    publicKey: row.public_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class KnownHostsRepository {
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.getStmt = db.prepare(`
      SELECT id, host, port, key_type, fingerprint, public_key, created_at, updated_at
      FROM known_hosts
      WHERE host = ? AND port = ? AND key_type = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO known_hosts (
        id, host, port, key_type, fingerprint, public_key, created_at, updated_at
      ) VALUES (
        @id, @host, @port, @key_type, @fingerprint, @public_key, @created_at, @updated_at
      )
    `)
    this.updateStmt = db.prepare(`
      UPDATE known_hosts
      SET fingerprint = @fingerprint,
          public_key = @public_key,
          updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`
      DELETE FROM known_hosts WHERE host = ? AND port = ? AND key_type = ?
    `)
  }

  get(host: string, port: number, keyType: string): KnownHost | null {
    const row = this.getStmt.get(host, port, keyType) as KnownHostRow | undefined
    return row ? mapRow(row) : null
  }

  upsert(input: {
    host: string
    port: number
    keyType: string
    fingerprint: string
    publicKey: Buffer
  }): KnownHost {
    const existing = this.get(input.host, input.port, input.keyType)
    const now = nowIso()

    if (existing) {
      this.updateStmt.run({
        id: existing.id,
        fingerprint: input.fingerprint,
        public_key: input.publicKey,
        updated_at: now
      })
      return {
        ...existing,
        fingerprint: input.fingerprint,
        publicKey: input.publicKey,
        updatedAt: now
      }
    }

    const entry: KnownHost = {
      id: newId(),
      host: input.host,
      port: input.port,
      keyType: input.keyType,
      fingerprint: input.fingerprint,
      publicKey: input.publicKey,
      createdAt: now,
      updatedAt: now
    }

    this.insertStmt.run({
      id: entry.id,
      host: entry.host,
      port: entry.port,
      key_type: entry.keyType,
      fingerprint: entry.fingerprint,
      public_key: entry.publicKey,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt
    })

    return entry
  }

  delete(host: string, port: number, keyType: string): void {
    this.deleteStmt.run(host, port, keyType)
  }
}
