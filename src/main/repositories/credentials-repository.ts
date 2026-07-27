import type { SqliteDatabase } from '../database/connection'

export type CredentialRow = {
  id: string
  ciphertext: Buffer
  createdAt: string
  updatedAt: string
}

type DbCredentialRow = {
  id: string
  ciphertext: Buffer
  created_at: string
  updated_at: string
}

function mapRow(row: DbCredentialRow): CredentialRow {
  return {
    id: row.id,
    ciphertext: Buffer.from(row.ciphertext),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class CredentialsRepository {
  private readonly getStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt
  private readonly hasStmt

  constructor(db: SqliteDatabase) {
    this.getStmt = db.prepare(`
      SELECT id, ciphertext, created_at, updated_at
      FROM credentials
      WHERE id = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO credentials (id, ciphertext, created_at, updated_at)
      VALUES (@id, @ciphertext, @created_at, @updated_at)
    `)
    this.updateStmt = db.prepare(`
      UPDATE credentials
      SET ciphertext = @ciphertext, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM credentials WHERE id = ?`)
    this.hasStmt = db.prepare(`SELECT 1 AS ok FROM credentials WHERE id = ? LIMIT 1`)
  }

  get(id: string): CredentialRow | null {
    const row = this.getStmt.get(id) as DbCredentialRow | undefined
    return row ? mapRow(row) : null
  }

  has(id: string): boolean {
    return Boolean(this.hasStmt.get(id))
  }

  insert(id: string, ciphertext: Buffer, createdAt: string, updatedAt: string): void {
    this.insertStmt.run({
      id,
      ciphertext,
      created_at: createdAt,
      updated_at: updatedAt
    })
  }

  update(id: string, ciphertext: Buffer, updatedAt: string): boolean {
    return this.updateStmt.run({ id, ciphertext, updated_at: updatedAt }).changes > 0
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }
}
