import type { CredentialVault } from '../vault'
import type { OrganizationClient } from './organization-client'

/** Why main needs a plaintext; organizations audit it (ADR 0018 §8). */
export type SecretPurpose = 'session' | 'reveal' | 'paste'

/**
 * Where a workspace keeps passwords. The personal workspace uses the local
 * vault (`safeStorage`); an organization keeps them on its North Server and
 * main fetches each one just in time, never caching it.
 */
export interface SecretStore {
  readonly kind: 'local' | 'remote'
  isAvailable(): Promise<boolean>
  /** Stores a secret; with `credentialRef`, replaces it in place when it exists. */
  set(secret: string, credentialRef?: string | null): Promise<string>
  delete(credentialRef: string): Promise<void>
  has(credentialRef: string): Promise<boolean>
  resolve(credentialRef: string, purpose: SecretPurpose): Promise<string>
}

export function localSecretStore(vault: CredentialVault): SecretStore {
  return {
    kind: 'local',
    isAvailable: async () => vault.isEncryptionAvailable(),
    set: async (secret, credentialRef) => vault.setSecret(secret, credentialRef),
    delete: async (credentialRef) => vault.deleteSecret(credentialRef),
    has: async (credentialRef) => vault.hasSecret(credentialRef),
    resolve: async (credentialRef) => vault.resolveSecret(credentialRef)
  }
}

const isNotFound = (error: unknown): boolean => (error as { status?: number }).status === 404

export class RemoteSecretStore implements SecretStore {
  readonly kind = 'remote' as const

  constructor(private readonly api: OrganizationClient) {}

  async isAvailable(): Promise<boolean> {
    // The server answers 503 with an explanation when it has no master key.
    return true
  }

  async set(secret: string, credentialRef?: string | null): Promise<string> {
    if (credentialRef) {
      try {
        await this.api.request('PUT', `/api/v1/secrets/${credentialRef}`, { value: secret })
        return credentialRef
      } catch (error) {
        if (!isNotFound(error)) throw error
      }
    }
    const { id } = await this.api.request<{ id: string }>('POST', '/api/v1/secrets', {
      value: secret
    })
    return id
  }

  async delete(credentialRef: string): Promise<void> {
    try {
      await this.api.request('DELETE', `/api/v1/secrets/${credentialRef}`)
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
  }

  async has(credentialRef: string): Promise<boolean> {
    try {
      await this.api.request('GET', `/api/v1/secrets/${credentialRef}`)
      return true
    } catch (error) {
      if (isNotFound(error)) return false
      throw error
    }
  }

  async resolve(credentialRef: string, purpose: SecretPurpose): Promise<string> {
    try {
      const { value } = await this.api.request<{ value: string }>(
        'POST',
        `/api/v1/secrets/${credentialRef}/reveal`,
        { purpose }
      )
      return value
    } catch (error) {
      if (isNotFound(error)) {
        throw new Error('A senha desta conexão não está mais na organização. Defina de novo.')
      }
      throw error
    }
  }
}
