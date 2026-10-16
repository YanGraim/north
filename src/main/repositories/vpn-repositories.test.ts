import type { VpnConfig } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'

const ovpnConfig: VpnConfig = {
  kind: 'openvpn',
  ovpn: 'client\ndev tun\nremote vpn.acme.com 1194 udp\n',
  requiresUserPass: true,
  requiresKeyPassphrase: false,
  remoteSummary: [{ host: 'vpn.acme.com', port: 1194, proto: 'udp' }],
  redirectGateway: false,
  declaredRoutes: []
}

describe('VpnProfilesRepository', () => {
  it('creates, lists, updates and deletes profiles', () => {
    const { repos } = createTestRepositories()
    const client = repos.clients.create({ name: 'Acme' })
    const created = repos.vpnProfiles.create({
      name: 'Acme VPN',
      clientId: client.id,
      config: ovpnConfig
    })

    expect(created).toMatchObject({
      name: 'Acme VPN',
      kind: 'openvpn',
      clientId: client.id,
      autoDisconnect: 'when-idle',
      idleTimeoutSec: 300,
      notes: null
    })
    expect(repos.vpnProfiles.get(created.id)?.config).toEqual(ovpnConfig)
    expect(repos.vpnProfiles.list().map((p) => p.id)).toEqual([created.id])

    const updated = repos.vpnProfiles.update(created.id, { name: 'Renamed', idleTimeoutSec: 60 })
    expect(updated?.name).toBe('Renamed')
    expect(updated?.idleTimeoutSec).toBe(60)
    expect(updated?.kind).toBe('openvpn')

    expect(repos.vpnProfiles.delete(created.id)).toBe(true)
    expect(repos.vpnProfiles.get(created.id)).toBeNull()
  })

  it('keeps kind in sync with config.kind on update', () => {
    const { repos } = createTestRepositories()
    const p = repos.vpnProfiles.create({ name: 'x', config: ovpnConfig })
    const updated = repos.vpnProfiles.update(p.id, {
      config: { kind: 'ipsec-ikev1', gateway: 'gw.example.com', username: 'u', xauth: 'saved' }
    })
    expect(updated?.kind).toBe('ipsec-ikev1')
  })

  it('setClientLink / setEnvironmentLink are nulled when the profile is deleted', () => {
    const { repos, db } = createTestRepositories()
    const client = repos.clients.create({ name: 'Acme' })
    const env = repos.environments.create({ clientId: client.id, name: 'prod' })
    const p = repos.vpnProfiles.create({ name: 'x', config: ovpnConfig })
    repos.vpnProfiles.setClientLink(client.id, p.id)
    repos.vpnProfiles.setEnvironmentLink(env.id, p.id)
    expect(repos.vpnProfiles.getLinks(p.id)).toEqual({
      clientIds: [client.id],
      environmentIds: [env.id]
    })

    repos.vpnProfiles.delete(p.id)
    const row = db.prepare(`SELECT vpn_profile_id FROM environments WHERE id = ?`).get(env.id) as {
      vpn_profile_id: string | null
    }
    expect(row.vpn_profile_id).toBeNull()
  })
})

describe('VpnSecretsRepository', () => {
  it('upserts, lists and cascades on profile delete', () => {
    const { repos } = createTestRepositories()
    const p = repos.vpnProfiles.create({ name: 'x', config: ovpnConfig })
    repos.vpnSecrets.upsert(p.id, 'password', 'ref-1')
    repos.vpnSecrets.upsert(p.id, 'password', 'ref-2')
    repos.vpnSecrets.upsert(p.id, 'psk', 'ref-3')

    expect(repos.vpnSecrets.get(p.id, 'password')).toBe('ref-2')
    expect(repos.vpnSecrets.listByProfile(p.id)).toEqual([
      { kind: 'password', credentialRef: 'ref-2' },
      { kind: 'psk', credentialRef: 'ref-3' }
    ])

    expect(repos.vpnSecrets.delete(p.id, 'psk')).toBe(true)
    repos.vpnProfiles.delete(p.id)
    expect(repos.vpnSecrets.listByProfile(p.id)).toEqual([])
  })
})

describe('VpnHistoryRepository', () => {
  it('records start and finish', () => {
    const { repos } = createTestRepositories()
    const p = repos.vpnProfiles.create({ name: 'x', config: ovpnConfig })
    const id = repos.vpnHistory.start(p.id, 'auto')
    repos.vpnHistory.finish(id, 'error', 'AUTH_FAILED')
    const [entry] = repos.vpnHistory.listByProfile(p.id)
    expect(entry).toMatchObject({ id, trigger: 'auto', result: 'error', errorCode: 'AUTH_FAILED' })
    expect(entry.endedAt).not.toBeNull()
  })
})
