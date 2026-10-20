import { InventoryExportSchema } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'
import type { Repositories } from '../repositories'
import { buildInventoryExport, importInventory } from './inventory-json'

/** A North with a client, its VPNs, a server behind the VPN, a workflow and a variable. */
function seed(repos: Repositories) {
  const client = repos.clients.create({ name: 'Poly' })
  const env = repos.environments.create({ clientId: client.id, name: 'Prod' })
  const group = repos.groups.create({ environmentId: env.id, name: 'App' })
  const poly = repos.vpnProfiles.create({
    clientId: client.id,
    name: 'VPN POLY',
    config: {
      kind: 'ipsec-ikev1',
      gateway: '170.82.195.66',
      groupName: 'poly',
      username: 'juannunes',
      xauth: 'saved',
      dnsDomains: ['poly.local']
    }
  })
  const forti = repos.vpnProfiles.create({
    name: 'Santinvest',
    config: {
      kind: 'fortinet-sslvpn',
      gateway: '200.186.1.74',
      port: 443,
      username: 'ana',
      trustedCert: 'a'.repeat(64)
    }
  })
  const personal = repos.vpnProfiles.create({
    name: 'Minha OpenVPN',
    config: {
      kind: 'openvpn',
      ovpn: 'client\nremote vpn.example.com 1194\n',
      requiresUserPass: true,
      requiresKeyPassphrase: false,
      username: 'ana',
      remoteSummary: [{ host: 'vpn.example.com', port: 1194, proto: 'udp' }],
      redirectGateway: false,
      declaredRoutes: []
    }
  })
  repos.vpnProfiles.setClientLink(client.id, poly.id)
  repos.vpnProfiles.setEnvironmentLink(env.id, personal.id)
  const web = repos.connections.create({
    groupId: group.id,
    name: 'web-01',
    protocol: 'ssh',
    host: '172.16.0.10',
    port: 22,
    username: 'ubuntu',
    authMethod: 'password',
    vpnMode: 'profile',
    vpnProfileId: forti.id
  })
  repos.connections.create({
    groupId: group.id,
    name: 'db-01',
    protocol: 'ssh',
    host: '172.16.0.11',
    port: 22,
    authMethod: 'password',
    vpnMode: 'profile',
    vpnProfileId: personal.id
  })
  repos.workflows.create({
    groupId: group.id,
    name: 'Deploy',
    description: 'Atualiza a API',
    preferredConnectionId: web.id,
    definition: {
      schemaVersion: 1,
      inputs: [],
      steps: [
        {
          id: crypto.randomUUID(),
          type: 'ssh.exec',
          name: 'Pull',
          policy: { onFailure: 'stop' },
          config: { command: 'cd {{APP_DIR}} && git pull' }
        }
      ]
    }
  })
  repos.groupVariables.create({ groupId: group.id, key: 'APP_DIR', value: '/srv/api' })
  return { client, env, group }
}

/** Export as the app writes it to disk, read back as the app reads it. */
function roundTrip(repos: Repositories) {
  const text = JSON.stringify(buildInventoryExport(repos))
  return { text, data: InventoryExportSchema.parse(JSON.parse(text)) }
}

describe('inventory JSON export/import (schemaVersion 3)', () => {
  it('exports workflows, variables and FortiGate VPNs, without users, secrets or OpenVPN', () => {
    const source = createTestRepositories().repos
    seed(source)
    const { text, data } = roundTrip(source)

    expect(data.schemaVersion).toBe(3)
    expect(data.vpns.map((v) => v.name).sort()).toEqual(['Santinvest', 'VPN POLY'])
    expect(data.vpns.every((v) => v.config.username === '')).toBe(true)
    // the user is personal; OpenVPN (and its .ovpn) is each person's own
    expect(text).not.toContain('juannunes')
    expect(text).not.toContain('"ana"')
    expect(text).not.toContain('Minha OpenVPN')
    expect(text).not.toContain('remote vpn.example.com')

    const group = data.clients[0].environments[0].groups[0]
    expect(group.workflows[0]).toMatchObject({ name: 'Deploy', preferredConnectionName: 'web-01' })
    expect(group.variables).toEqual([{ key: 'APP_DIR', value: '/srv/api', description: null }])
    expect(data.clients[0].vpnName).toBe('VPN POLY')
    // linked to the OpenVPN that isn't in the file: nothing to point at
    expect(data.clients[0].environments[0].vpnName).toBeNull()
    expect(group.connections.find((c) => c.name === 'db-01')).toMatchObject({ vpnMode: 'inherit' })
  })

  it('imports everything into another North, pointing at the imported VPNs', () => {
    const source = createTestRepositories().repos
    seed(source)
    const target = createTestRepositories().repos
    const report = importInventory(target, roundTrip(source).data)

    expect(report.errors).toEqual([])
    expect(report.created).toMatchObject({
      clients: 1,
      connections: 2,
      workflows: 1,
      variables: 1,
      vpns: 2
    })

    const client = target.clients.list()[0]
    const vpns = target.vpnProfiles.list()
    const poly = vpns.find((v) => v.name === 'VPN POLY')
    expect(poly?.config).toMatchObject({
      gateway: '170.82.195.66',
      groupName: 'poly',
      username: ''
    })
    expect(poly?.clientId).toBe(client.id)
    expect(target.vpnProfiles.linkForClient(client.id)).toBe(poly?.id)

    const env = target.environments.list(client.id)[0]
    const group = target.groups.list(env.id)[0]
    const connections = target.connections.list({ groupId: group.id })
    const web = connections.find((c) => c.name === 'web-01')
    expect(web).toMatchObject({
      username: 'ubuntu',
      vpnMode: 'profile',
      vpnProfileId: vpns.find((v) => v.name === 'Santinvest')?.id
    })

    const [workflow] = target.workflows.listByGroup(group.id)
    expect(workflow).toMatchObject({ name: 'Deploy', preferredConnectionId: web?.id })
    expect(workflow.definition.steps[0].config).toEqual({
      command: 'cd {{APP_DIR}} && git pull'
    })
    expect(target.groupVariables.toRecord(group.id)).toEqual({ APP_DIR: '/srv/api' })
  })

  it('importing twice changes nothing: everything already there is skipped', () => {
    const source = createTestRepositories().repos
    seed(source)
    const target = createTestRepositories().repos
    const { data } = roundTrip(source)
    importInventory(target, data)
    const again = importInventory(target, data)

    expect(Object.values(again.created).every((n) => n === 0)).toBe(true)
    expect(again.skipped).toMatchObject({ workflows: 1, variables: 1, vpns: 2, connections: 2 })
    expect(target.vpnProfiles.list()).toHaveLength(2)
  })

  it('a VPN already set up here keeps its user, and links to it by name', () => {
    const source = createTestRepositories().repos
    seed(source)
    const target = createTestRepositories().repos
    const mine = target.vpnProfiles.create({
      name: 'vpn poly',
      config: { kind: 'ipsec-ikev1', gateway: 'x', username: 'meu', xauth: 'saved' }
    })
    importInventory(target, roundTrip(source).data)

    expect(target.vpnProfiles.get(mine.id)?.config).toMatchObject({ username: 'meu' })
    const client = target.clients.list()[0]
    expect(target.vpnProfiles.linkForClient(client.id)).toBe(mine.id)
  })

  it('still reads files from older Norths (schemaVersion 2)', () => {
    const target = createTestRepositories().repos
    const report = importInventory(
      target,
      InventoryExportSchema.parse({
        schemaVersion: 2,
        exportedAt: '2026-01-01T00:00:00.000Z',
        tags: [],
        clients: [
          {
            name: 'Acme',
            environments: [
              {
                name: 'Prod',
                groups: [
                  {
                    name: 'App',
                    connections: [
                      { name: 'a', protocol: 'ssh', host: 'h', port: 22, authMethod: 'password' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      })
    )
    expect(report.errors).toEqual([])
    expect(report.created.connections).toBe(1)
  })
})
