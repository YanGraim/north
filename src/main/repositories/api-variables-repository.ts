import type { ApiVariable, SetApiVariableInput } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'
import { boolToInt, intToBool, newId, nowIso } from './row-utils'

type VariableRow = {
  id: string
  access_id: string
  key: string
  value: string | null
  is_secret: number
  credential_ref: string | null
  description: string | null
  created_at: string
  updated_at: string
}

function mapVariable(row: VariableRow): ApiVariable {
  return {
    id: row.id,
    accessId: row.access_id,
    key: row.key,
    value: row.value,
    isSecret: intToBool(row.is_secret),
    credentialRef: row.credential_ref,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ApiVariablesRepository {
  private readonly listByAccessStmt
  private readonly getStmt
  private readonly getByKeyStmt
  private readonly insertStmt
  private readonly updateStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listByAccessStmt = db.prepare(`
      SELECT id, access_id, key, value, is_secret, credential_ref, description, created_at, updated_at
      FROM api_variables
      WHERE access_id = ?
      ORDER BY key COLLATE NOCASE ASC
    `)
    this.getStmt = db.prepare(`
      SELECT id, access_id, key, value, is_secret, credential_ref, description, created_at, updated_at
      FROM api_variables
      WHERE id = ?
    `)
    this.getByKeyStmt = db.prepare(`
      SELECT id, access_id, key, value, is_secret, credential_ref, description, created_at, updated_at
      FROM api_variables
      WHERE access_id = ? AND key = ?
    `)
    this.insertStmt = db.prepare(`
      INSERT INTO api_variables (
        id, access_id, key, value, is_secret, credential_ref, description, created_at, updated_at
      ) VALUES (
        @id, @access_id, @key, @value, @is_secret, @credential_ref, @description, @created_at, @updated_at
      )
    `)
    this.updateStmt = db.prepare(`
      UPDATE api_variables
      SET key = @key, value = @value, is_secret = @is_secret, credential_ref = @credential_ref,
          description = @description, updated_at = @updated_at
      WHERE id = @id
    `)
    this.deleteStmt = db.prepare(`DELETE FROM api_variables WHERE id = ?`)
  }

  listByAccess(accessId: string): ApiVariable[] {
    return (this.listByAccessStmt.all(accessId) as VariableRow[]).map(mapVariable)
  }

  get(id: string): ApiVariable | null {
    const row = this.getStmt.get(id) as VariableRow | undefined
    return row ? mapVariable(row) : null
  }

  getByKey(accessId: string, key: string): ApiVariable | null {
    const row = this.getByKeyStmt.get(accessId, key) as VariableRow | undefined
    return row ? mapVariable(row) : null
  }

  upsert(input: SetApiVariableInput & { credentialRef?: string | null }): ApiVariable {
    const existing = this.getByKey(input.accessId, input.key)
    const now = nowIso()
    const isSecret = input.isSecret ?? existing?.isSecret ?? false
    const credentialRef =
      input.credentialRef === undefined ? (existing?.credentialRef ?? null) : input.credentialRef
    const value = isSecret ? null : (input.value ?? existing?.value ?? '')
    const description =
      input.description === undefined ? (existing?.description ?? null) : input.description

    if (existing) {
      const updated: ApiVariable = {
        ...existing,
        value,
        isSecret,
        credentialRef,
        description,
        updatedAt: now
      }
      this.updateStmt.run({
        id: updated.id,
        key: updated.key,
        value: updated.value,
        is_secret: boolToInt(updated.isSecret),
        credential_ref: updated.credentialRef,
        description: updated.description,
        updated_at: updated.updatedAt
      })
      return updated
    }

    const variable: ApiVariable = {
      id: newId(),
      accessId: input.accessId,
      key: input.key,
      value,
      isSecret,
      credentialRef,
      description,
      createdAt: now,
      updatedAt: now
    }
    this.insertStmt.run({
      id: variable.id,
      access_id: variable.accessId,
      key: variable.key,
      value: variable.value,
      is_secret: boolToInt(variable.isSecret),
      credential_ref: variable.credentialRef,
      description: variable.description,
      created_at: variable.createdAt,
      updated_at: variable.updatedAt
    })
    return variable
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0
  }
}
