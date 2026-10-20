import { LOCAL_WORKSPACE_ID } from '@shared/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase } from '../database/test-utils'
import { createRepositories } from '../repositories'
import { WorkspacesRepository } from '../repositories/workspaces-repository'
import { CredentialVault, FakeEncryptor } from '../vault'
import { OrganizationSignedOutError } from './organization-client'
import { ORGANIZATION_UNAVAILABLE } from './remote-inventory-store'
import { startTestServer } from './test-server'
import { createScopedRepositories, WorkspaceRegistry } from './workspace-registry'

let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  server = await startTestServer()
}, 60_000)

afterAll(async () => {
  await server.stop()
})

function setup() {
  const db = createTestDatabase()
  const local = createRepositories(db)
  const workspaces = new WorkspacesRepository(db)
  const vault = new CredentialVault(local.credentials, new FakeEncryptor())
  const registry = new WorkspaceRegistry({ workspaces, local, vault })
  return { db, local, workspaces, vault, registry }
}

describe('WorkspaceRegistry — local', () => {
  it('starts on the local workspace', () => {
    const { registry } = setup()
    expect(registry.activeId()).toBe(LOCAL_WORKSPACE_ID)
    expect(registry.activeSource().kind).toBe('local')
  })

  it('lists workspaces from the repository', () => {
    const { registry } = setup()
    expect(registry.list().map((w) => w.id)).toEqual([LOCAL_WORKSPACE_ID])
  })

  it('activates the local workspace and returns it', async () => {
    const { registry } = setup()
    expect((await registry.activate(LOCAL_WORKSPACE_ID)).id).toBe(LOCAL_WORKSPACE_ID)
  })

  it('rejects an unknown workspace and keeps the current one active', async () => {
    const { registry } = setup()
    await expect(registry.activate('ghost')).rejects.toThrow(/not found/i)
    expect(registry.activeId()).toBe(LOCAL_WORKSPACE_ID)
  })

  it('rejects an invalid id', async () => {
    const { registry } = setup()
    await expect(registry.activate('../x')).rejects.toThrow()
  })

  it('reads the local inventory through the async store', async () => {
    const { local, registry } = setup()
    local.clients.create({ name: 'Mine' })
    expect((await registry.inventory().clients.list()).map((c) => c.name)).toEqual(['Mine'])
  })
})

describe('WorkspaceRegistry — organizations', () => {
  it('adds an organization: signs in, stores the refresh token in the vault, keeps no secret in the row', async () => {
    const { registry, db } = setup()
    const workspace = await registry.addOrganization({
      serverUrl: server.url,
      email: 'ana@acme.com',
      name: 'Ana'
    })
    expect(workspace).toMatchObject({
      kind: 'organization',
      name: 'Acme Test',
      serverUrl: server.url,
      userEmail: 'ana@acme.com'
    })
    expect(workspace.id).toMatch(/^acme-test-[a-z0-9]{4}$/)
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspace.id) as Record<
      string,
      unknown
    >
    expect(row.refresh_credential_ref).toEqual(expect.any(String))
    expect(JSON.stringify(row)).not.toMatch(/eyJ/)
  })

  it('signing in again to the same server reuses the workspace', async () => {
    const { registry } = setup()
    const a = await registry.addOrganization({ serverUrl: server.url, email: 'ana@acme.com' })
    const b = await registry.addOrganization({ serverUrl: `${server.url}/`, email: 'ana@acme.com' })
    expect(b.id).toBe(a.id)
    expect(registry.list()).toHaveLength(2)
  })

  it('activating an organization switches inventory to the server', async () => {
    const { registry, local } = setup()
    local.clients.create({ name: 'Only on this computer' })
    const org = await registry.addOrganization({ serverUrl: server.url, email: 'bia@acme.com' })
    await registry.activate(org.id)
    expect(registry.activeSource().kind).toBe('remote')
    const created = await registry.inventory().clients.create({ name: 'Org client' })
    const names = (await registry.inventory().clients.list()).map((c) => c.name)
    expect(names).toContain('Org client')
    expect(names).not.toContain('Only on this computer')
    expect(local.clients.get(created.id)).toBeNull()
  })

  it('switching back to local restores local data', async () => {
    const { registry, local } = setup()
    local.clients.create({ name: 'Mine' })
    const org = await registry.addOrganization({ serverUrl: server.url, email: 'cris@acme.com' })
    await registry.activate(org.id)
    await registry.activate(LOCAL_WORKSPACE_ID)
    expect((await registry.inventory().clients.list()).map((c) => c.name)).toEqual(['Mine'])
  })

  it('survives a restart: a new registry signs in from the vaulted refresh token', async () => {
    const first = setup()
    const org = await first.registry.addOrganization({
      serverUrl: server.url,
      email: 'dani@acme.com'
    })
    const restarted = new WorkspaceRegistry({
      workspaces: first.workspaces,
      local: first.local,
      vault: first.vault
    })
    await restarted.activate(org.id)
    await expect(restarted.inventory().clients.list()).resolves.toEqual(expect.any(Array))
  })

  it('refuses to activate when the session is gone and stays where it was', async () => {
    const { registry } = setup()
    const org = await registry.addOrganization({ serverUrl: server.url, email: 'edu@acme.com' })
    await server.db.query(`UPDATE users SET disabled_at = now() WHERE email = 'edu@acme.com'`)
    await expect(registry.activate(org.id)).rejects.toBeInstanceOf(OrganizationSignedOutError)
    expect(registry.activeId()).toBe(LOCAL_WORKSPACE_ID)
  })

  it('features not in the organization yet: lists are empty, actions explain why', async () => {
    const { registry } = setup()
    const org = await registry.addOrganization({ serverUrl: server.url, email: 'fabi@acme.com' })
    await registry.activate(org.id)
    const repos = registry.activeSource().repositories
    expect(repos.accesses.list()).toEqual([])
    expect(repos.history.list({})).toEqual([])
    expect(() => repos.accesses.get('x')).toThrow(ORGANIZATION_UNAVAILABLE)
    expect(() => repos.workflows.create({} as never)).toThrow(ORGANIZATION_UNAVAILABLE)
  })

  it('removing an organization signs out, wipes the vault blob and falls back to local', async () => {
    const { registry, vault, db } = setup()
    const org = await registry.addOrganization({ serverUrl: server.url, email: 'gil@acme.com' })
    const ref = (
      db.prepare('SELECT refresh_credential_ref AS r FROM workspaces WHERE id = ?').get(org.id) as {
        r: string
      }
    ).r
    await registry.activate(org.id)
    await registry.removeOrganization(org.id)
    expect(registry.activeId()).toBe(LOCAL_WORKSPACE_ID)
    expect(registry.list().map((w) => w.id)).toEqual([LOCAL_WORKSPACE_ID])
    expect(vault.hasSecret(ref)).toBe(false)
  })

  it('keeps organization passwords on the server, not in the local vault', async () => {
    const { registry, local } = setup()
    expect(registry.secrets().kind).toBe('local')
    const org = await registry.addOrganization({ serverUrl: server.url, email: 'hugo@acme.com' })
    await registry.activate(org.id)
    const secrets = registry.secrets()
    expect(secrets.kind).toBe('remote')
    const before = local.credentials
    const ref = await secrets.set('org-password')
    const client = await registry.inventory().clients.create({ name: 'Sec' })
    const env = await registry.inventory().environments.create({ clientId: client.id, name: 'E' })
    const group = await registry.inventory().groups.create({ environmentId: env.id, name: 'G' })
    await registry.inventory().connections.create({
      groupId: group.id,
      name: 'db',
      protocol: 'ssh',
      host: 'h',
      port: 22,
      authMethod: 'password',
      credentialRef: ref
    })
    expect(before.has(ref)).toBe(false)
    expect(await secrets.resolve(ref, 'session')).toBe('org-password')
    await registry.activate(LOCAL_WORKSPACE_ID)
    expect(registry.secrets().kind).toBe('local')
  })

  it('host keys stay per machine, whatever workspace is active', async () => {
    const { registry, local } = setup()
    const org = await registry.addOrganization({ serverUrl: server.url, email: 'ines@acme.com' })
    await registry.activate(org.id)
    expect(registry.activeSource().repositories.knownHosts).toBe(local.knownHosts)
  })

  it('never removes the local workspace', async () => {
    const { registry } = setup()
    await expect(registry.removeOrganization(LOCAL_WORKSPACE_ID)).rejects.toThrow()
  })

  it('surfaces probe errors when adding', async () => {
    const { registry } = setup()
    await expect(
      registry.addOrganization({ serverUrl: 'http://127.0.0.1:1', email: 'x@acme.com' })
    ).rejects.toThrow(/não respondeu/)
    expect(registry.list()).toHaveLength(1)
  })
})

describe('createScopedRepositories', () => {
  it('resolves each repository through the active workspace at call time', () => {
    const { local, registry } = setup()
    const scoped = createScopedRepositories(registry)
    expect(scoped.clients).toBe(local.clients)
  })

  it('exposes every repository key of the local set', () => {
    const { local, registry } = setup()
    expect(Object.keys(createScopedRepositories(registry)).sort()).toEqual(
      Object.keys(local).sort()
    )
  })
})
