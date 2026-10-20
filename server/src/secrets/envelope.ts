import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

/**
 * Envelope encryption (ADR 0018 §8): each secret gets its own data key
 * (AES-256-GCM), and the data key is wrapped by the operator's master key.
 * The secret id is the AAD of both layers, so a row moved to another id
 * stops opening. Each field is `iv.tag.data` in base64.
 */
export type Sealed = { wrappedKey: string; ciphertext: string }

function encrypt(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad))
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.')
}

function decrypt(key: Buffer, encoded: string, aad: string): Buffer {
  const [iv, tag, data] = encoded.split('.').map((part) => Buffer.from(part, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(aad))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

export function seal(masterKey: Buffer, plaintext: string, secretId: string): Sealed {
  const dataKey = randomBytes(32)
  return {
    wrappedKey: encrypt(masterKey, dataKey, secretId),
    ciphertext: encrypt(dataKey, Buffer.from(plaintext, 'utf8'), secretId)
  }
}

export function open(masterKey: Buffer, sealed: Sealed, secretId: string): string {
  const dataKey = decrypt(masterKey, sealed.wrappedKey, secretId)
  return decrypt(dataKey, sealed.ciphertext, secretId).toString('utf8')
}

/** `NORTH_MASTER_KEY` (base64) or `NORTH_MASTER_KEY_FILE` (Docker/K8s secret). */
export function loadMasterKey(
  env: Record<string, string | undefined>,
  readFile: (path: string) => string = (path) => readFileSync(path, 'utf8')
): Buffer | null {
  const raw = env.NORTH_MASTER_KEY_FILE
    ? readFile(env.NORTH_MASTER_KEY_FILE).trim()
    : env.NORTH_MASTER_KEY?.trim()
  if (!raw) return null
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      'Invalid configuration — the master key must be 32 bytes in base64 (openssl rand -base64 32)'
    )
  }
  return key
}
