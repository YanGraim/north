import type { CredentialsRepository } from '../repositories/credentials-repository'
import { newId, nowIso } from '../repositories/row-utils'
import type { Encryptor } from './encryptor'

export class CredentialVault {
  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly encryptor: Encryptor
  ) {}

  isEncryptionAvailable(): boolean {
    return this.encryptor.isAvailable()
  }

  /**
   * Encrypt and persist a secret. When `credentialRef` is provided and already exists,
   * replaces the ciphertext in place (stable ref). Otherwise creates a new row.
   */
  setSecret(secret: string, credentialRef?: string | null): string {
    if (!secret) {
      throw new Error('Secret must not be empty')
    }
    if (!this.encryptor.isAvailable()) {
      throw new Error('Credential encryption is not available on this system')
    }

    const ciphertext = this.encryptor.encrypt(secret)
    const now = nowIso()
    const ref = credentialRef ?? newId()

    if (credentialRef && this.credentials.has(credentialRef)) {
      this.credentials.update(credentialRef, ciphertext, now)
      return credentialRef
    }

    this.credentials.insert(ref, ciphertext, now, now)
    return ref
  }

  deleteSecret(credentialRef: string): void {
    this.credentials.delete(credentialRef)
  }

  hasSecret(credentialRef: string): boolean {
    return this.credentials.has(credentialRef)
  }

  /** Resolve plaintext for drivers — never expose via IPC. */
  resolveSecret(credentialRef: string): string {
    const row = this.credentials.get(credentialRef)
    if (!row) {
      throw new Error('Credential not found')
    }
    if (!this.encryptor.isAvailable()) {
      throw new Error('Credential encryption is not available on this system')
    }
    try {
      return this.encryptor.decrypt(row.ciphertext)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('Não foi possível ler a senha salva')
      ) {
        throw error
      }
      throw new Error(
        'Não foi possível ler a senha salva. Edite a conexão e defina a senha novamente.'
      )
    }
  }
}
