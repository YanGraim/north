import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../../database/test-utils'
import { CredentialVault, FakeEncryptor } from '../../vault'
import { VpnProfileService } from './vpn-profile-service'

const ovpn = readFileSync(
  resolve(__dirname, '../../../../test/fixtures/ovpn/inline-userpass-encrypted-key.ovpn'),
  'utf8'
)

function setup() {
  const { repos, db } = createTestRepositories()
  const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
  return { repos, db, vault, service: new VpnProfileService(repos, vault) }
}

describe('VpnProfileService', () => {
  it('importOvpn creates the profile and moves inline key blocks to the vault', () => {
    const { service, repos, db } = setup()
    const result = service.importOvpn({ content: ovpn })

    expect(result.profile.name).toBe('vpn.acme.com')
    expect(result.inlineBlocks.sort()).toEqual(['key', 'tls-crypt'])
    expect(JSON.stringify(result)).not.toContain('MIIFAKEENCRYPTEDKEY')

    const rows = db.prepare(`SELECT config FROM vpn_profiles`).all() as Array<{ config: string }>
    expect(rows[0].config).not.toContain('MIIFAKEENCRYPTEDKEY')

    expect(repos.vpnSecrets.get(result.profile.id, 'ovpn-inline')).not.toBeNull()
    expect(service.resolveInlineBlocks(result.profile.id)).toMatchObject({
      key: expect.stringContaining('MIIFAKEENCRYPTEDKEY')
    })
  })

  it('setSecret stores, replaces in place, and empty string deletes', () => {
    const { service, repos } = setup()
    const { profile } = service.importOvpn({ content: ovpn, name: 'Acme' })

    service.setSecret({ profileId: profile.id, kind: 'password', secret: 'one' })
    const ref = repos.vpnSecrets.get(profile.id, 'password')
    service.setSecret({ profileId: profile.id, kind: 'password', secret: 'two' })
    expect(repos.vpnSecrets.get(profile.id, 'password')).toBe(ref)
    expect(service.resolveSecret(profile.id, 'password')).toBe('two')
    expect(service.secretStatus(profile.id)).toMatchObject({ password: true, psk: false })

    service.setSecret({ profileId: profile.id, kind: 'password', secret: '' })
    expect(service.resolveSecret(profile.id, 'password')).toBeNull()
    expect(repos.credentials.has(ref as string)).toBe(false)
  })

  it('setSecret refuses ovpn-inline from the outside', () => {
    const { service } = setup()
    const { profile } = service.importOvpn({ content: ovpn })
    expect(() =>
      service.setSecret({ profileId: profile.id, kind: 'ovpn-inline', secret: 'x' })
    ).toThrow()
  })

  it('delete wipes the vault blobs too', () => {
    const { service, repos, db } = setup()
    const { profile } = service.importOvpn({ content: ovpn })
    service.setSecret({ profileId: profile.id, kind: 'password', secret: 'pw' })
    expect(service.delete(profile.id)).toBe(true)
    expect(db.prepare(`SELECT COUNT(*) AS n FROM credentials`).get()).toEqual({ n: 0 })
    expect(repos.vpnProfiles.get(profile.id)).toBeNull()
  })
})
