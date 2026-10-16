import { IpcChannels } from '@shared/ipc'
import { formatVpnErrorMessage } from '@shared/lib/vpn/errors'
import {
  CreateVpnProfileInputSchema,
  IdSchema,
  ImportOvpnInputSchema,
  SetVpnSecretInputSchema,
  UpdateVpnProfileInputSchema,
  VpnConnectInputSchema,
  type VpnKind,
  type VpnSecretKind,
  type VpnState
} from '@shared/types'
import type { Repositories } from '../../repositories'
import type { CredentialVault } from '../../vault'
import { createFakeVpnDriverFactory } from './drivers/fake-vpn-driver'
import { MacosIpsecDriver, type MacosIpsecDriverDeps } from './drivers/macos-ipsec-driver'
import { OpenfortivpnDriver, type OpenfortivpnDriverDeps } from './drivers/openfortivpn-driver'
import { OpenVpnDriver } from './drivers/openvpn-driver'
import { VpnDriverRegistry } from './drivers/vpn-driver'
import type { PrivilegeBroker } from './privilege-broker'
import type { TunnelRegistry } from './tunnel-registry'
import { VpnError } from './vpn-error'
import { VpnManager } from './vpn-manager'
import { VpnProfileService } from './vpn-profile-service'

const REDACTABLE: VpnSecretKind[] = ['password', 'key-passphrase', 'psk']

export type VpnRuntimeDeps = {
  repos: Repositories
  vault: CredentialVault
  platform: NodeJS.Platform
  emit: (state: VpnState) => void
  /** NORTH_VPN_FAKE=1 / tests: register the fake driver for every kind. */
  fake?: boolean
  openvpn?: {
    binary: () => string | null
    broker: PrivilegeBroker
    tmpDir: string
    tunnels: TunnelRegistry
  }
  macosIpsec?: MacosIpsecDriverDeps
  openfortivpn?: OpenfortivpnDriverDeps
}

export function createVpnRuntime(deps: VpnRuntimeDeps) {
  const profiles = new VpnProfileService(deps.repos, deps.vault)
  const drivers = new VpnDriverRegistry()

  if (deps.fake) {
    for (const kind of ['openvpn', 'ipsec-ikev1', 'ipsec-ikev2', 'fortinet-sslvpn'] as VpnKind[]) {
      drivers.register(createFakeVpnDriverFactory(kind, () => ({ connectDelayMs: 800 })))
    }
  } else if (deps.openvpn) {
    const openvpn = deps.openvpn
    drivers.register({
      kind: 'openvpn',
      isSupported: (platform) =>
        platform === 'win32'
          ? { ok: false, reason: 'No Windows, o OpenVPN depende do Interactive Service (em breve)' }
          : { ok: true },
      create: () => new OpenVpnDriver(openvpn)
    })
  }
  if (!deps.fake && deps.macosIpsec) {
    const ipsec = deps.macosIpsec
    drivers.register({
      kind: 'ipsec-ikev1',
      isSupported: (platform) =>
        platform === 'darwin'
          ? { ok: true }
          : {
              ok: false,
              reason: 'IPsec IKEv1 só no macOS por enquanto (Windows usará o FortiClient)'
            },
      create: () => new MacosIpsecDriver(ipsec)
    })
  }
  if (!deps.fake && deps.openfortivpn) {
    const forti = deps.openfortivpn
    drivers.register({
      kind: 'fortinet-sslvpn',
      isSupported: (platform) =>
        platform === 'win32'
          ? { ok: false, reason: 'No Windows, o SSL-VPN ainda não é suportado (em breve)' }
          : { ok: true },
      create: () => new OpenfortivpnDriver(forti)
    })
  }

  const manager = new VpnManager({
    profiles,
    secrets: (profileId) => ({
      get: (kind) => profiles.resolveSecret(profileId, kind),
      inlineBlocks: () => profiles.resolveInlineBlocks(profileId),
      values: () =>
        REDACTABLE.map((kind) => profiles.resolveSecret(profileId, kind)).filter((v): v is string =>
          Boolean(v)
        )
    }),
    drivers,
    history: deps.repos.vpnHistory,
    platform: deps.platform,
    emit: deps.emit
  })

  return { profiles, drivers, manager }
}

export type VpnRuntime = ReturnType<typeof createVpnRuntime>

function rethrow(error: unknown): never {
  if (error instanceof VpnError) throw new Error(formatVpnErrorMessage(error.code, error.message))
  throw error
}

/**
 * Channel → handler map. Every payload is parsed as untrusted input; no result
 * carries a secret (covered by vpn-runtime.test.ts).
 */
export function createVpnHandlers(runtime: VpnRuntime, platform: NodeJS.Platform) {
  const { profiles, manager, drivers } = runtime
  return {
    [IpcChannels.VPN_LIST]: () => profiles.list(),
    [IpcChannels.VPN_GET]: (id: unknown) => profiles.get(IdSchema.parse(id)),
    [IpcChannels.VPN_CREATE]: (input: unknown) =>
      profiles.create(CreateVpnProfileInputSchema.parse(input)),
    [IpcChannels.VPN_UPDATE]: (id: unknown, input: unknown) => {
      const updated = profiles.update(IdSchema.parse(id), UpdateVpnProfileInputSchema.parse(input))
      if (!updated) throw new Error('VPN não encontrada')
      return updated
    },
    [IpcChannels.VPN_DELETE]: async (id: unknown) => {
      const profileId = IdSchema.parse(id)
      await manager.disconnect(profileId)
      profiles.delete(profileId)
    },
    [IpcChannels.VPN_IMPORT_OVPN]: (input: unknown) => {
      try {
        return profiles.importOvpn(ImportOvpnInputSchema.parse(input))
      } catch (error) {
        if (error instanceof Error && error.name === 'OvpnParseError') {
          throw new Error(formatVpnErrorMessage('INVALID_CONFIG', error.message))
        }
        throw error
      }
    },
    [IpcChannels.VPN_SET_SECRET]: (input: unknown) => {
      const parsed = SetVpnSecretInputSchema.parse(input)
      profiles.setSecret(parsed)
      return profiles.secretStatus(parsed.profileId)
    },
    [IpcChannels.VPN_SECRET_STATUS]: (id: unknown) => profiles.secretStatus(IdSchema.parse(id)),
    [IpcChannels.VPN_CONNECT]: async (input: unknown) => {
      const parsed = VpnConnectInputSchema.parse(input)
      try {
        return await manager.connect(parsed.profileId, { force: parsed.force })
      } catch (error) {
        rethrow(error)
      }
    },
    [IpcChannels.VPN_DISCONNECT]: async (id: unknown) => {
      const profileId = IdSchema.parse(id)
      await manager.disconnect(profileId)
      return manager.getState(profileId)
    },
    [IpcChannels.VPN_STATUS]: () => profiles.list().map((p) => manager.getState(p.id)),
    [IpcChannels.VPN_LOGS]: (id: unknown) => manager.logs(IdSchema.parse(id)),
    [IpcChannels.VPN_HISTORY]: (id: unknown, limit?: unknown) =>
      profiles.history(IdSchema.parse(id), limit === undefined ? undefined : Number(limit)),
    [IpcChannels.VPN_CHECK_CONFLICTS]: (id: unknown) => manager.checkConflicts(IdSchema.parse(id)),
    [IpcChannels.VPN_PLATFORM_SUPPORT]: () => drivers.support(platform)
  }
}
