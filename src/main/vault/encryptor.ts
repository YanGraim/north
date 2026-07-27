import { safeStorage } from 'electron'

/** Abstraction over OS-backed encryption so Vitest can run without Electron. */
export interface Encryptor {
  isAvailable(): boolean
  encrypt(plainText: string): Buffer
  decrypt(cipherText: Buffer): string
}

export class SafeStorageEncryptor implements Encryptor {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  encrypt(plainText: string): Buffer {
    return safeStorage.encryptString(plainText)
  }

  decrypt(cipherText: Buffer): string {
    try {
      return safeStorage.decryptString(cipherText)
    } catch {
      throw new Error(
        'Não foi possível ler a senha salva. Edite a conexão e defina a senha novamente.'
      )
    }
  }
}

/** Deterministic encryptor for unit tests (not secure — never use in production). */
export class FakeEncryptor implements Encryptor {
  isAvailable(): boolean {
    return true
  }

  encrypt(plainText: string): Buffer {
    // Base64 so the plaintext is not a substring of the stored blob.
    return Buffer.from(Buffer.from(plainText, 'utf8').toString('base64'), 'utf8')
  }

  decrypt(cipherText: Buffer): string {
    return Buffer.from(cipherText.toString('utf8'), 'base64').toString('utf8')
  }
}

export class UnavailableEncryptor implements Encryptor {
  isAvailable(): boolean {
    return false
  }

  encrypt(_plainText: string): Buffer {
    throw new Error('Credential encryption is not available on this system')
  }

  decrypt(_cipherText: Buffer): string {
    throw new Error('Credential encryption is not available on this system')
  }
}
