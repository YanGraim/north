import { parseOvpn } from '@shared/lib/vpn/ovpn-parse'
import {
  type CreateVpnProfileInput,
  type ImportOvpnInput,
  type OvpnImportResult,
  type SetVpnSecretInput,
  type UpdateVpnProfileInput,
  type VpnProfile,
  type VpnSecretKind,
  VpnSecretKindSchema,
  type VpnSecretStatus
} from '@shared/types'
import type { Repositories } from '../../repositories'
import type { CredentialVault } from '../../vault'

/**
 * Profiles + their vault-backed secrets. Main-only: `resolve*` return plaintext
 * for drivers and must never feed an IPC result.
 */
export class VpnProfileService {
  constructor(
    private readonly repos: Repositories,
    private readonly vault: CredentialVault
  ) {}

  list(): VpnProfile[] {
    return this.repos.vpnProfiles.list()
  }

  get(id: string): VpnProfile | null {
    return this.repos.vpnProfiles.get(id)
  }

  create(input: CreateVpnProfileInput): VpnProfile {
    return this.repos.vpnProfiles.create(input)
  }

  update(id: string, input: UpdateVpnProfileInput): VpnProfile | null {
    return this.repos.vpnProfiles.update(id, input)
  }

  importOvpn(input: ImportOvpnInput): OvpnImportResult {
    const parsed = parseOvpn(input.content)
    const profile = this.repos.vpnProfiles.create({
      name: input.name ?? parsed.suggestedName,
      clientId: input.clientId ?? null,
      config: parsed.config
    })
    const blockNames = Object.keys(parsed.inlineBlocks)
    if (blockNames.length > 0) {
      this.store(profile.id, 'ovpn-inline', JSON.stringify(parsed.inlineBlocks))
    }
    return { profile, inlineBlocks: blockNames }
  }

  setSecret(input: SetVpnSecretInput): void {
    if (input.kind === 'ovpn-inline') {
      throw new Error('Blocos inline do .ovpn só podem ser definidos pela importação')
    }
    if (!this.repos.vpnProfiles.get(input.profileId)) {
      throw new Error('VPN não encontrada')
    }
    if (input.secret === '') {
      const ref = this.repos.vpnSecrets.get(input.profileId, input.kind)
      if (ref) this.vault.deleteSecret(ref)
      this.repos.vpnSecrets.delete(input.profileId, input.kind)
      return
    }
    this.store(input.profileId, input.kind, input.secret)
  }

  secretStatus(profileId: string): VpnSecretStatus {
    const present = new Set(this.repos.vpnSecrets.listByProfile(profileId).map((s) => s.kind))
    return Object.fromEntries(
      VpnSecretKindSchema.options.map((kind) => [kind, present.has(kind)])
    ) as VpnSecretStatus
  }

  resolveSecret(profileId: string, kind: VpnSecretKind): string | null {
    const ref = this.repos.vpnSecrets.get(profileId, kind)
    return ref ? this.vault.resolveSecret(ref) : null
  }

  resolveInlineBlocks(profileId: string): Record<string, string> {
    const raw = this.resolveSecret(profileId, 'ovpn-inline')
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  }

  delete(id: string): boolean {
    for (const secret of this.repos.vpnSecrets.listByProfile(id)) {
      this.vault.deleteSecret(secret.credentialRef)
    }
    return this.repos.vpnProfiles.delete(id)
  }

  history(profileId: string, limit?: number) {
    return this.repos.vpnHistory.listByProfile(profileId, limit)
  }

  private store(profileId: string, kind: VpnSecretKind, secret: string): void {
    const existing = this.repos.vpnSecrets.get(profileId, kind)
    const ref = this.vault.setSecret(secret, existing)
    this.repos.vpnSecrets.upsert(profileId, kind, ref)
  }
}
