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
    expect(report.created).toEqual({
      clients: 1,
      environments: 1,
      groups: 1,
      connections: 2,
      accesses: 1,
      workflows: 0
    })
    expect(report.passwordsCopied).toBe(1)
    expect(report.warnings).toEqual([])

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
    const accesses = await inventory.accesses.list({ clientId: report.root.id })
    expect(accesses).toEqual([
      expect.objectContaining({ name: 'portal', type: 'login', url: 'https://portal.example' })
    ])
  })

  it('takes the group workflows and variables along, there and back', async () => {
    const { registry, local, vault, org } = await setup()
    const { client, group, web } = seedLocal(local, vault)
    local.groupVariables.create({ groupId: group.id, key: 'APP_DIR', value: '/srv/app' })
    local.workflows.create({
      groupId: group.id,
      name: 'Atualizar backend',
      preferredConnectionId: web.id,
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: crypto.randomUUID(),
            type: 'ssh.exec',
            name: 'pull',
            policy: { onFailure: 'stop' },
            config: { command: 'git pull' }
          }
        ],
        tracking: { type: 'git-update', repositoryPath: '/srv/app' }
      }
    })
    const report = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    })
    expect(report.created.workflows).toBe(1)
    expect(report.warnings).toEqual([])

    await registry.activate(org.id)
    const [orgEnv] = await registry.inventory().environments.list(report.root.id)
    const [orgGroup] = await registry.inventory().groups.list(orgEnv.id)
    const orgWeb = (await registry.inventory().connections.list({ groupId: orgGroup.id })).find(
      (c) => c.name === 'web-01'
    )
    const [workflow] = await registry.workflows().workflows.listByGroup(orgGroup.id)
    expect(workflow).toMatchObject({
      name: 'Atualizar backend',
      preferredConnectionId: orgWeb?.id,
      definition: { tracking: { repositoryPath: '/srv/app' } }
    })
    expect(await registry.workflows().variables.listByGroup(orgGroup.id)).toMatchObject([
      { key: 'APP_DIR', value: '/srv/app' }
    ])

    // And back into Meu workspace, from the organization.
    const back = await registry.copyToWorkspace({
      kind: 'group',
      id: orgGroup.id,
      sourceWorkspaceId: org.id,
      targetWorkspaceId: LOCAL_WORKSPACE_ID,
      targetParentId: local.environments.list(client.id)[0].id,
      includePasswords: false
    })
    expect(back.created.workflows).toBe(1)
    expect(local.workflows.listByGroup(back.root.id)).toHaveLength(1)
    expect(local.groupVariables.toRecord(back.root.id)).toEqual({ APP_DIR: '/srv/app' })
  })

  it('takes the client VPN along; another computer gets it without anyone’s login', async () => {
    const { registry, local, vault, org } = await setup()
    const { client, web } = seedLocal(local, vault)
    const forti = local.vpnProfiles.create({
      name: 'Acme VPN',
      config: { kind: 'fortinet-sslvpn', gateway: 'vpn.acme.com', port: 10443, username: 'ana' }
    })
    local.vpnProfiles.setClientLink(client.id, forti.id)
    local.connections.update(web.id, { vpnMode: 'profile', vpnProfileId: forti.id })
    const report = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    })
    expect(report.warnings).toEqual([])

    // Here: the organization points back at this computer's own profile.
    await registry.activate(org.id)
    expect(await registry.organizationVpnLink('client', report.root.id)).toBe(forti.id)
    const copied = (await registry.inventory().connections.list({ clientId: report.root.id })).find(
      (c) => c.name === 'web-01'
    )
    expect(copied?.vpnProfileId).toBe(forti.id)
    expect(local.vpnProfiles.list()).toHaveLength(1)

    // Someone else, on another computer: a profile with the gateway and no login.
    const other = await setup()
    await other.registry.activate(other.org.id)
    const theirs = await other.registry.organizationVpnLink('client', report.root.id)
    const profile = other.local.vpnProfiles.get(theirs as string)
    expect(profile?.config).toMatchObject({
      kind: 'fortinet-sslvpn',
      gateway: 'vpn.acme.com',
      port: 10443,
      username: ''
    })
    const conn = (
      await other.registry.inventory().connections.list({ clientId: report.root.id })
    ).find((c) => c.name === 'web-01')
    expect(conn?.vpnProfileId).toBe(theirs)
    expect(await other.registry.organizationVpnFor(conn as NonNullable<typeof conn>)).toBe(theirs)
  })

  it('reuses a profile the person already has for the same gateway', async () => {
    const { registry, local, vault, org } = await setup()
    const { client } = seedLocal(local, vault)
    const forti = local.vpnProfiles.create({
      name: 'Acme',
      config: { kind: 'fortinet-sslvpn', gateway: 'vpn.reuse.com', port: 443, username: 'ana' }
    })
    local.vpnProfiles.setClientLink(client.id, forti.id)
    const report = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    })
    const other = await setup()
    const mine = other.local.vpnProfiles.create({
      name: 'Minha VPN da Acme',
      config: { kind: 'fortinet-sslvpn', gateway: 'VPN.reuse.com', port: 443, username: 'bia' }
    })
    await other.registry.activate(other.org.id)
    expect(await other.registry.organizationVpnLink('client', report.root.id)).toBe(mine.id)
    expect(other.local.vpnProfiles.list()).toHaveLength(1)
  })

  it('shares only the address of an OpenVPN and keeps it linked here', async () => {
    const { registry, local, vault, org } = await setup()
    const { client } = seedLocal(local, vault)
    const ovpn = local.vpnProfiles.create({
      name: 'Pessoal',
      config: {
        kind: 'openvpn',
        ovpn: 'client\nremote vpn.example 1194\n',
        requiresUserPass: false,
        requiresKeyPassphrase: false,
        remoteSummary: [{ host: 'vpn.example', port: 1194, proto: 'udp' }],
        redirectGateway: false,
        declaredRoutes: []
      }
    })
    local.vpnProfiles.setClientLink(client.id, ovpn.id)
    const report = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    })
    expect(report.created.connections).toBe(2)
    expect(report.warnings).toEqual([])
    await registry.activate(org.id)
    expect(await registry.organizationVpnLink('client', report.root.id)).toBe(ovpn.id)
  })

  it('OpenVPN: each person uses their own .ovpn, matched by server address', async () => {
    const { registry, local, vault, org } = await setup()
    const { client } = seedLocal(local, vault)
    const ovpn = local.vpnProfiles.create({
      name: 'Ecofitus',
      config: {
        kind: 'openvpn',
        ovpn: 'client\nremote vpn.ovpn.test 1194 udp\n<cert>\nMINE\n</cert>\n',
        requiresUserPass: true,
        requiresKeyPassphrase: true,
        remoteSummary: [{ host: 'vpn.ovpn.test', port: 1194, proto: 'udp' }],
        redirectGateway: false,
        declaredRoutes: []
      }
    })
    local.vpnProfiles.setClientLink(client.id, ovpn.id)
    const report = await registry.copyToWorkspace({
      kind: 'client',
      id: client.id,
      targetWorkspaceId: org.id,
      targetParentId: null,
      includePasswords: false
    })

    // Someone without the file: told to import it, nothing half-made on their computer.
    const other = await setup()
    await other.registry.activate(other.org.id)
    expect(await other.registry.organizationVpnLink('client', report.root.id)).toBeNull()
    const conn = (
      await other.registry.inventory().connections.list({ clientId: report.root.id })
    ).find((c) => c.name === 'web-01')
    if (!conn) throw new Error('web-01 not copied')
    await expect(other.registry.organizationVpnFor(conn)).rejects.toThrow(/Importe o seu/)
    expect(other.local.vpnProfiles.list()).toHaveLength(0)

    // Once they import their own .ovpn for the same server, it is used.
    const theirs = other.local.vpnProfiles.create({
      name: 'Minha Ecofitus',
      config: {
        kind: 'openvpn',
        ovpn: 'client\nremote VPN.ovpn.test 1194 udp\n',
        requiresUserPass: true,
        requiresKeyPassphrase: false,
        remoteSummary: [{ host: 'VPN.ovpn.test', port: 1194, proto: 'udp' }],
        redirectGateway: false,
        declaredRoutes: []
      }
    })
    expect(await other.registry.organizationVpnFor(conn)).toBe(theirs.id)
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
