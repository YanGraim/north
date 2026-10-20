import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate, migrations, openDatabase } from '../database'
import { createRepositories } from '../repositories'
import { CredentialVault, FakeEncryptor } from '../vault'
import { memoryTokenStore, OrganizationClient } from './organization-client'
import { RemoteInventoryStore } from './remote-inventory-store'
import { localSecretStore, RemoteSecretStore } from './secret-store'
import { startTestServer } from './test-server'

describe('localSecretStore', () => {
  function setup() {
    const db = openDatabase(':memory:')
    migrate(db, migrations)
    const vault = new CredentialVault(createRepositories(db).credentials, new FakeEncryptor())
    return { vault, store: localSecretStore(vault) }
  }

  it('is the vault behind an async face', async () => {
    const { vault, store } = setup()
    expect(store.kind).toBe('local')
    expect(await store.isAvailable()).toBe(true)
    const ref = await store.set('hunter2')
    expect(vault.resolveSecret(ref)).toBe('hunter2')
    expect(await store.has(ref)).toBe(true)
    expect(await store.resolve(ref, 'session')).toBe('hunter2')
    expect(await store.set('new', ref)).toBe(ref)
    expect(await store.resolve(ref, 'reveal')).toBe('new')
    await store.delete(ref)
    expect(await store.has(ref)).toBe(false)
  })
})

describe('RemoteSecretStore', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>
  let store: RemoteSecretStore
  let inventory: RemoteInventoryStore

  beforeAll(async () => {
    server = await startTestServer()
    const client = new OrganizationClient(server.url, memoryTokenStore())
    await client.devLogin('ana@acme.com')
    store = new RemoteSecretStore(client)
    inventory = new RemoteInventoryStore(client)
  }, 60_000)

  afterAll(async () => {
    await server.stop()
  })

  async function connectionWith(credentialRef: string | null) {
    const client = await inventory.clients.create({ name: `Acme ${Math.random()}` })
    const env = await inventory.environments.create({ clientId: client.id, name: 'Prod' })
    const group = await inventory.groups.create({ environmentId: env.id, name: 'Web' })
    return inventory.connections.create({
      groupId: group.id,
      name: 'web-01',
      protocol: 'ssh',
      host: '10.0.0.1',
      port: 22,
      authMethod: 'password',
      credentialRef
    })
  }

  it('stores the password on the server and gets it back just in time', async () => {
    expect(store.kind).toBe('remote')
    expect(await store.isAvailable()).toBe(true)
    const ref = await store.set('hunter2')
    const conn = await connectionWith(ref)
    expect(conn.credentialRef).toBe(ref)
    expect(await store.has(ref)).toBe(true)
    expect(await store.resolve(ref, 'session')).toBe('hunter2')
  })

  it('replaces a password in place, keeping the reference', async () => {
    const ref = await store.set('old')
    await connectionWith(ref)
    expect(await store.set('new', ref)).toBe(ref)
    expect(await store.resolve(ref, 'session')).toBe('new')
  })

  it('creates a new secret when the reference it got is not on the server', async () => {
    const ref = await store.set('x', '3f1c2b9e-1111-4222-8333-444455556666')
    expect(ref).not.toBe('3f1c2b9e-1111-4222-8333-444455556666')
    expect(await store.has(ref)).toBe(true)
  })

  it('says a missing secret does not exist and deleting twice is fine', async () => {
    const ref = await store.set('x')
    await store.delete(ref)
    expect(await store.has(ref)).toBe(false)
    await expect(store.delete(ref)).resolves.toBeUndefined()
  })

  it('explains when the secret is gone', async () => {
    const ref = await store.set('x')
    await expect(store.resolve(ref, 'session')).rejects.toThrow(/senha/i)
  })

  it('every reveal shows up in the audit with its purpose', async () => {
    const ref = await store.set('hunter2')
    const conn = await connectionWith(ref)
    await store.resolve(ref, 'paste')
    const res = await server.app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: {
        authorization: `Bearer ${(await server.app.inject({ method: 'POST', url: '/api/v1/auth/dev/login', payload: { email: 'ana@acme.com' } })).json().accessToken}`
      }
    })
    const read = res.json().find((e: { action: string }) => e.action === 'secret.read')
    expect(read).toMatchObject({ targetId: conn.id, detail: { purpose: 'paste' } })
  })
})
