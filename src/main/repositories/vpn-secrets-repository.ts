import type { VpnSecretKind } from '@shared/types'
import type { SqliteDatabase } from '../database/connection'

export type VpnSecretRef = { kind: VpnSecretKind; credentialRef: string }

/** `(vpn_profile_id, kind) → credential_ref` bag — same shape as `connection_secrets`. */
export class VpnSecretsRepository {
  private readonly listStmt
  private readonly getStmt
  private readonly upsertStmt
  private readonly deleteStmt

  constructor(db: SqliteDatabase) {
    this.listStmt = db.prepare(
      `SELECT kind, credential_ref FROM vpn_secrets WHERE vpn_profile_id = ? ORDER BY kind ASC`
    )
    this.getStmt = db.prepare(
      `SELECT credential_ref FROM vpn_secrets WHERE vpn_profile_id = ? AND kind = ?`
    )
    this.upsertStmt = db.prepare(`
      INSERT INTO vpn_secrets (vpn_profile_id, kind, credential_ref) VALUES (?, ?, ?)
      ON CONFLICT (vpn_profile_id, kind) DO UPDATE SET credential_ref = excluded.credential_ref
    `)
    this.deleteStmt = db.prepare(`DELETE FROM vpn_secrets WHERE vpn_profile_id = ? AND kind = ?`)
  }

  listByProfile(profileId: string): VpnSecretRef[] {
    return (
      this.listStmt.all(profileId) as Array<{ kind: VpnSecretKind; credential_ref: string }>
    ).map((r) => ({ kind: r.kind, credentialRef: r.credential_ref }))
  }

  get(profileId: string, kind: VpnSecretKind): string | null {
    const row = this.getStmt.get(profileId, kind) as { credential_ref: string } | undefined
    return row?.credential_ref ?? null
  }

  upsert(profileId: string, kind: VpnSecretKind, credentialRef: string): void {
    this.upsertStmt.run(profileId, kind, credentialRef)
  }

  delete(profileId: string, kind: VpnSecretKind): boolean {
    return this.deleteStmt.run(profileId, kind).changes > 0
  }
}
