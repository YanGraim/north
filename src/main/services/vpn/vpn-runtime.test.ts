import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import { parseVpnErrorMessage } from '@shared/lib/vpn/errors'
import type { VpnState } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../../database/test-utils'
import { CredentialVault, FakeEncryptor } from '../../vault'
import { createVpnHandlers, createVpnRuntime } from './vpn-runtime'

const ovpn = readFileSync(
  resolve(__dirname, '../../../../test/fixtures/ovpn/inline-userpass-encrypted-key.ovpn'),
  'utf8'
)

function setup() {
  const { repos } = createTestRepositories()
  const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
  const events: VpnState[] = []
  const runtime = createVpnRuntime({
    repos,
    vault,
    platform: 'darwin',
    emit: (s) => events.push(s),
    fake: true
  })
  return { handlers: createVpnHandlers(runtime, 'darwin'), events, runtime }
}

describe('VPN IPC handlers', () => {
  it('no handler result ever carries a secret', async () => {
    const { handlers, events } = setup()
    const results: unknown[] = []
    const imported = await handlers[IpcChannels.VPN_IMPORT_OVPN]({ content: ovpn, name: 'Acme' })
    results.push(imported)
    const id = imported.profile.id
    results.push(
      await handlers[IpcChannels.VPN_SET_SECRET]({
        profileId: id,
        kind: 'password',
        secret: 'TopSecretPw!'
      })
    )
    results.push(
      await handlers[IpcChannels.VPN_SET_SECRET]({
        profileId: id,
        kind: 'key-passphrase',
        secret: 'KeyPass#42'
      })
    )
    results.push(handlers[IpcChannels.VPN_LIST]())
    results.push(handlers[IpcChannels.VPN_GET](id))
    results.push(handlers[IpcChannels.VPN_SECRET_STATUS](id))
    const connecting = handlers[IpcChannels.VPN_CONNECT]({ profileId: id })
    results.push(await connecting)
    results.push(handlers[IpcChannels.VPN_STATUS]())
    results.push(handlers[IpcChannels.VPN_LOGS](id))
    results.push(handlers[IpcChannels.VPN_HISTORY](id))
    results.push(handlers[IpcChannels.VPN_CHECK_CONFLICTS](id))
    results.push(handlers[IpcChannels.VPN_PLATFORM_SUPPORT]())
    results.push(await handlers[IpcChannels.VPN_DISCONNECT](id))
    results.push(events)

    const blob = JSON.stringify(results)
    for (const secret of [
      'TopSecretPw!',
      'KeyPass#42',
      'MIIFAKEENCRYPTEDKEY',
      'deadbeefdeadbeef'
    ]) {
      expect(blob).not.toContain(secret)
    }
    expect(handlers[IpcChannels.VPN_SECRET_STATUS](id)).toMatchObject({
      password: true,
      'key-passphrase': true,
      'ovpn-inline': true,
      psk: false
    })
  }, 10_000)

  it('prepare-access brings up the VPN the access resolves to and keeps it on', async () => {
    const PORTAL = crypto.randomUUID()
    const { repos } = createTestRepositories()
    const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
    const runtime = createVpnRuntime({
      repos,
      vault,
      platform: 'darwin',
      emit: () => {},
      fake: true
    })
    const handlers = createVpnHandlers(runtime, 'darwin', undefined, (id) =>
      id === PORTAL ? profileId : null
    )
    const { profile } = await handlers[IpcChannels.VPN_IMPORT_OVPN]({ content: ovpn, name: 'Poly' })
    const profileId = profile.id
    await handlers[IpcChannels.VPN_SET_SECRET]({ profileId, kind: 'password', secret: 'pw' })
    await handlers[IpcChannels.VPN_SET_SECRET]({ profileId, kind: 'key-passphrase', secret: 'kp' })
    expect(await handlers[IpcChannels.VPN_PREPARE_ACCESS](crypto.randomUUID())).toBeNull()
    expect(await handlers[IpcChannels.VPN_PREPARE_ACCESS](PORTAL)).toMatchObject({
      profileId,
      status: 'connected'
    })
    expect(runtime.manager.getState(profileId).status).toBe('connected')
  })

  it('rejects malformed payloads', async () => {
    const { handlers } = setup()
    expect(() => handlers[IpcChannels.VPN_GET]('not-a-uuid')).toThrow()
    expect(() => handlers[IpcChannels.VPN_CREATE]({ name: '', config: {} })).toThrow()
    expect(() =>
      handlers[IpcChannels.VPN_SET_SECRET]({
        profileId: crypto.randomUUID(),
        kind: 'nope',
        secret: 'x'
      })
    ).toThrow()
  })

  it('import errors carry an INVALID_CONFIG code the renderer can parse', () => {
    const { handlers } = setup()
    try {
      handlers[IpcChannels.VPN_IMPORT_OVPN]({ content: 'client\nremote a\nup /x.sh\n' })
      expect.unreachable()
    } catch (error) {
      expect(parseVpnErrorMessage((error as Error).message)?.code).toBe('INVALID_CONFIG')
    }
  })

  it('delete disconnects and wipes the profile', async () => {
    const { handlers, runtime } = setup()
    const { profile } = handlers[IpcChannels.VPN_IMPORT_OVPN]({ content: ovpn })
    await handlers[IpcChannels.VPN_DELETE](profile.id)
    expect(handlers[IpcChannels.VPN_LIST]()).toEqual([])
    expect(runtime.manager.listStates().every((s) => s.status === 'disconnected')).toBe(true)
  })
})
