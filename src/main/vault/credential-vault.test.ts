import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'
import { CredentialVault, FakeEncryptor, UnavailableEncryptor } from '../vault'

describe('CredentialsRepository', () => {
  it('stores and retrieves ciphertext blobs', () => {
    const { repos } = createTestRepositories()
    const id = randomUUID()
    const cipher = Buffer.from('opaque-bytes')

    repos.credentials.insert(id, cipher, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')

    const row = repos.credentials.get(id)
    expect(row).not.toBeNull()
    expect(row?.ciphertext.equals(cipher)).toBe(true)
    expect(repos.credentials.has(id)).toBe(true)
  })

  it('updates ciphertext in place', () => {
    const { repos } = createTestRepositories()
    const id = randomUUID()
    repos.credentials.insert(
      id,
      Buffer.from('v1'),
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    )
    repos.credentials.update(id, Buffer.from('v2'), '2026-01-02T00:00:00.000Z')

    expect(repos.credentials.get(id)?.ciphertext.toString('utf8')).toBe('v2')
    expect(repos.credentials.get(id)?.updatedAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('deletes credentials', () => {
    const { repos } = createTestRepositories()
    const id = randomUUID()
    repos.credentials.insert(
      id,
      Buffer.from('x'),
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    )
    expect(repos.credentials.delete(id)).toBe(true)
    expect(repos.credentials.has(id)).toBe(false)
  })
})

describe('CredentialVault', () => {
  it('encrypts secrets and never stores plaintext in the credentials table', () => {
    const { db, repos } = createTestRepositories()
    const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
    const secret = 's3cret-password'

    const ref = vault.setSecret(secret)

    expect(vault.hasSecret(ref)).toBe(true)
    expect(vault.resolveSecret(ref)).toBe(secret)

    const raw = db.prepare(`SELECT ciphertext FROM credentials WHERE id = ?`).get(ref) as {
      ciphertext: Buffer
    }
    expect(raw.ciphertext.toString('utf8')).not.toContain(secret)
    expect(raw.ciphertext.equals(Buffer.from(secret, 'utf8'))).toBe(false)
  })

  it('keeps credentialRef stable when replacing a secret', () => {
    const { repos } = createTestRepositories()
    const vault = new CredentialVault(repos.credentials, new FakeEncryptor())

    const ref = vault.setSecret('first')
    const sameRef = vault.setSecret('second', ref)

    expect(sameRef).toBe(ref)
    expect(vault.resolveSecret(ref)).toBe('second')
  })

  it('reports unavailable encryption and refuses to store secrets', () => {
    const { repos } = createTestRepositories()
    const vault = new CredentialVault(repos.credentials, new UnavailableEncryptor())

    expect(vault.isEncryptionAvailable()).toBe(false)
    expect(() => vault.setSecret('nope')).toThrow(/not available/)
  })

  it('deletes secrets by ref', () => {
    const { repos } = createTestRepositories()
    const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
    const ref = vault.setSecret('temp')
    vault.deleteSecret(ref)
    expect(vault.hasSecret(ref)).toBe(false)
  })

  it('surfaces a stable message when decrypt fails', () => {
    const { repos } = createTestRepositories()
    const failingEncryptor = {
      isAvailable: () => true,
      encrypt: (plainText: string) => Buffer.from(plainText, 'utf8'),
      decrypt: () => {
        throw new Error('decryptString blew up')
      }
    }
    const vault = new CredentialVault(repos.credentials, failingEncryptor)
    const ref = vault.setSecret('hidden')

    expect(() => vault.resolveSecret(ref)).toThrow(
      /Não foi possível ler a senha salva\. Edite a conexão e defina a senha novamente\./
    )
  })
})
