import { LOCAL_WORKSPACE_ID } from '@shared/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase } from '../database/test-utils'
import { createRepositories } from '../repositories'
import { WorkspacesRepository } from '../repositories/workspaces-repository'
import { CredentialVault, FakeEncryptor } from '../vault'
import { startTestServer } from './test-server'
import { WorkspaceRegistry } from './workspace-registry'

/** "Copiar para workspace…" between the personal workspace and a real North Server. */
let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  server = await startTestServer()
}, 60_000)
afterAll(() => server.stop())

let seq = 0
async function setup(admin = true) {
  const db = createTestDatabase()
  const local = createRepositories(db)
  const workspaces = new WorkspacesRepository(db)
  const vault = new CredentialVault(local.credentials, new FakeEncryptor())
  const registry = new WorkspaceRegistry({ workspaces, local, vault, liveEvents: false })
  const email = `copy-${++seq}@acme.com`
  const org = await registry.addOrganization({ serverUrl: server.url, email })
  if (admin) await server.makeAdmin(email)
  return { registry, local, vault, org, email }
}

/** A personal tree: Acme → Prod → Web { web-01 (password, tags, jump via bastion), bastion }. */
function seedLocal(local: ReturnType<typeof createRepositories>, vault: CredentialVault) {
  const client = local.clients.create({ name: `Acme ${seq}`, notes: 'n', color: '#ff0000' })
  const env = local.environments.create({ clientId: client.id, name: 'Prod' })
  const group = local.groups.create({ environmentId: env.id, name: 'Web' })
  const base = {
    groupId: group.id,
    protocol: 'ssh' as const,
    port: 22,
    authMethod: 'password' as const
  }
  const bastion = local.connections.create({ ...base, name: 'bastion', host: '10.0.0.1' })
  const web = local.connections.create({
    ...base,
    name: 'web-01',
    host: '10.0.0.2',
    username: 'ubuntu',
    credentialRef: vault.setSecret('s3cret'),
    jumpHostId: bastion.id,
    notes: 'nginx',
    isFavorite: true
  })
  const tag = local.tags.create({ name: 'linux', color: '#00ff00' })
  local.tags.setForConnection({ connectionId: web.id, tagIds: [tag.id] })
  local.accesses.create({
    groupId: group.id,
    type: 'login',
    name: 'portal',
    description: null,
    notes: null,
    username: 'ana',
    credentialRef: null,
    url: 'https://portal.example',
    links: [],
    icon: null,
    color: null,
    isFavorite: false,
    engine: null,
    host: null,
    port: null,
    database: null,
    ssl: null
  })
  return { client, env, group, bastion, web }
}

describe('copy from Meu workspace to an organization', () => {
  it('copies a whole client: tree, connections, tags, jump host and passwords', async () => {
    const { registry, local, vault, org } = await setup()
    const { client } = seedLocal(local, vault)
    const report = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: true
    })
    expect(report.created).toEqual({ clients: 1, environments: 1, groups: 1, connections: 2 })
    expect(report.passwordsCopied).toBe(1)
    expect(report.warnings).toEqual([
      '1 acesso(s) de banco/login ficaram de fora: a organização ainda não guarda acessos'
    ])

    await registry.activate(org.id)
    const inventory = registry.inventory()
    const copied = await inventory.clients.get(report.root.id)
    expect(copied).toMatchObject({ name: client.name, notes: 'n', color: '#ff0000' })
    const connections = await inventory.connections.list({ clientId: report.root.id })
    const web = connections.find((c) => c.name === 'web-01')
    const bastion = connections.find((c) => c.name === 'bastion')
    expect(web).toMatchObject({ host: '10.0.0.2', username: 'ubuntu', notes: 'nginx' })
    expect(web?.isFavorite).toBe(false)
    expect(web?.jumpHostId).toBe(bastion?.id)
    expect(await registry.secrets().resolve(web?.credentialRef as string, 'reveal')).toBe('s3cret')
    const tags = await inventory.tags.listForConnection(web?.id as string)
    expect(tags.map((t) => t.name)).toEqual(['linux'])
  })

  it('the copy is unlinked: editing it leaves the original alone', async () => {
    const { registry, local, vault, org } = await setup()
    const { group, web } = seedLocal(local, vault)
    const orgGroups = await registry.copyTargets(org.id)
    expect(orgGroups.groups).toEqual(expect.any(Array))
    const target = await registry.copyToWorkspace({
      kind: 'client',
      id: local.clients.list()[0].id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    })
    await registry.activate(org.id)
    const copies = await registry.inventory().connections.list({ clientId: target.root.id })
    const copy = copies.find((c) => c.name === 'web-01')
    await registry.inventory().connections.update(copy?.id as string, { host: '192.168.0.9' })
    expect(local.connections.get(web.id)?.host).toBe('10.0.0.2')
    expect(local.groups.get(group.id)?.name).toBe('Web')
  })

  it('without "copiar senhas" the copy has no password', async () => {
    const { registry, local, vault, org } = await setup()
    const { client } = seedLocal(local, vault)
    const report = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    })
    expect(report.passwordsCopied).toBe(0)
    await registry.activate(org.id)
    const connections = await registry.inventory().connections.list({ clientId: report.root.id })
    expect(connections.every((c) => c.credentialRef === null)).toBe(true)
  })

  it('copies one connection into a chosen group, renaming on a clash, warning about its jump host', async () => {
    const { registry, local, vault, org } = await setup()
    const { client, web } = seedLocal(local, vault)
    const first = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    })
    const targets = await registry.copyTargets(org.id)
    const env = targets.environments.find((e) => e.clientId === first.root.id)
    const group = targets.groups.find((g) => g.environmentId === env?.id)
    const report = await registry.copyToWorkspace({
      kind: 'connection',
      id: web.id,
      targetWorkspaceId: org.id,
      targetParentId: group?.id as string,
      includePasswords: true
    })
    expect(report.created.connections).toBe(1)
    expect(report.warnings).toEqual(['“web-01”: o jump host não veio junto; configure de novo'])
    await registry.activate(org.id)
    expect((await registry.inventory().connections.get(report.root.id))?.name).toBe(
      'web-01 (cópia)'
    )
  })

  it('copying the same client twice keeps both, the second named "(cópia)"', async () => {
    const { registry, local, vault, org } = await setup()
    const { client } = seedLocal(local, vault)
    const input = {
      kind: 'client' as const,
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    }
    await registry.copyToWorkspace(input)
    const second = await registry.copyToWorkspace(input)
    await registry.activate(org.id)
    expect((await registry.inventory().clients.get(second.root.id))?.name).toBe(
      `${client.name} (cópia)`
    )
  })

  it('a member without access cannot drop things into the organization', async () => {
    const { registry, local, vault, org } = await setup(false)
    const { client } = seedLocal(local, vault)
    await expect(
      registry.copyToWorkspace({
        kind: 'client',
        id: client.id,
        targetWorkspaceId: org.id,
        targetParentId: null,
        includePasswords: false
      })
    ).rejects.toThrow()
  })

  it('refuses copying into the workspace you are in', async () => {
    const { registry, local, vault } = await setup()
    const { client } = seedLocal(local, vault)
    await expect(
      registry.copyToWorkspace({
        kind: 'client',
        id: client.id,
        targetWorkspaceId: LOCAL_WORKSPACE_ID,
        targetParentId: null,
        includePasswords: false
      })
    ).rejects.toThrow(/outro workspace/)
  })

  it('an environment needs a destination client', async () => {
    const { registry, local, vault, org } = await setup()
    const { env } = seedLocal(local, vault)
    await expect(
      registry.copyToWorkspace({
        kind: 'environment',
        id: env.id,
        targetWorkspaceId: org.id,
        targetParentId: null,
        includePasswords: false
      })
    ).rejects.toThrow(/Escolha onde/)
  })
})

describe('copy from an organization to Meu workspace', () => {
  it('brings a group with its connections and passwords into the local vault', async () => {
    const { registry, local, vault, org } = await setup()
    const { client } = seedLocal(local, vault)
    const up = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: true
    })
    await registry.activate(org.id)
    const orgEnv = (await registry.inventory().environments.list(up.root.id))[0]
    const group = (await registry.inventory().groups.list(orgEnv.id))[0]

    const localEnv = local.environments.list()[0]
    const report = await registry.copyToWorkspace({
      kind: 'group',
      id: group.id,
      targetWorkspaceId: LOCAL_WORKSPACE_ID,
      targetParentId: localEnv.id,
      includePasswords: true
    })
    expect(report.created).toMatchObject({ groups: 1, connections: 2 })
    expect(report.passwordsCopied).toBe(1)
    expect(local.groups.get(report.root.id)?.name).toBe('Web (cópia)')
    const web = local.connections.list({ groupId: report.root.id }).find((c) => c.name === 'web-01')
    expect(vault.resolveSecret(web?.credentialRef as string)).toBe('s3cret')
  })

  it('reading each password is audited on the server as a reveal', async () => {
    const { registry, local, vault, org, email } = await setup()
    const { client } = seedLocal(local, vault)
    const up = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: true
    })
    await registry.activate(org.id)
    await registry.copyToWorkspace({
      kind: 'client',
      id: up.root.id,
      targetWorkspaceId: LOCAL_WORKSPACE_ID,
      targetParentId: null,
      includePasswords: true
    })
    const { rows } = await server.db.query<{ detail: unknown }>(
      `SELECT detail FROM audit_events WHERE action = 'secret.read' AND user_email = $1`,
      [email]
    )
    expect(JSON.stringify(rows)).toContain('reveal')
  })
})
