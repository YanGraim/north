import { IpcChannels } from '@shared/ipc'
import { classifyComponentFailure, formatVpnErrorMessage } from '@shared/lib/vpn/errors'
import {
  CreateVpnProfileInputSchema,
  IdSchema,
  ImportOvpnInputSchema,
  SetVpnLinkInputSchema,
  SetVpnSecretInputSchema,
  UpdateVpnProfileInputSchema,
  VpnConnectInputSchema,
  type VpnHelperStatus,
  VpnKindSchema,
  VpnLinkTargetSchema,
  type VpnProfile,
  type VpnSecretKind,
  type VpnState
} from '@shared/types'
import type { Repositories } from '../../repositories'
import type { CredentialVault } from '../../vault'
import { createFakeVpnDriverFactory } from './drivers/fake-vpn-driver'
import { MacosIpsecDriver, type MacosIpsecDriverDeps } from './drivers/macos-ipsec-driver'
import { OpenconnectDriver, type OpenconnectDriverDeps } from './drivers/openconnect-driver'
import { OpenfortivpnDriver, type OpenfortivpnDriverDeps } from './drivers/openfortivpn-driver'
import { OpenVpnDriver, type OpenVpnDriverDeps } from './drivers/openvpn-driver'
import { StrongswanDriver, type StrongswanDriverDeps } from './drivers/strongswan-driver'
import { VpnDriverRegistry } from './drivers/vpn-driver'
import { WindowsNativeDriver, type WindowsNativeDriverDeps } from './drivers/windows-native-driver'
import type { PrivilegeBroker } from './privilege-broker'
import type { TunnelRegistry } from './tunnel-registry'
import { VpnError } from './vpn-error'
import type { VpnHelper } from './vpn-helper'
import { VpnManager } from './vpn-manager'
import type { VpnNoticeEvent } from './vpn-notices'
import { VpnProfileService } from './vpn-profile-service'

const REDACTABLE: VpnSecretKind[] = ['password', 'key-passphrase', 'psk']

export type VpnRuntimeDeps = {
  repos: Repositories
  vault: CredentialVault
  platform: NodeJS.Platform
  emit: (state: VpnState) => void
  onNotice?: (event: VpnNoticeEvent) => void
  /** NORTH_VPN_FAKE=1 / tests: register the fake driver for every kind. */
  fake?: boolean
  openvpn?: {
    binary: () => string | null
    broker: PrivilegeBroker
    tmpDir: string
    tunnels: TunnelRegistry
    helper?: OpenVpnDriverDeps['helper']
    prepare?: OpenVpnDriverDeps['prepare']
    logToFile?: boolean
  }
  macosIpsec?: MacosIpsecDriverDeps
  /** IKEv1 via strongSwan: root helper (macOS/Linux) or WSL (Windows); wins over macosIpsec. */
  strongswan?: StrongswanDriverDeps
  /** Windows FortiGate SSL-VPN: openconnect via north-vpn-service */
  openconnect?: OpenconnectDriverDeps
  openfortivpn?: OpenfortivpnDriverDeps
  /** Windows' built-in VPN client (PPTP, L2TP, SSTP, IKEv2) via rasdial */
  windowsNative?: WindowsNativeDriverDeps
}

export function createVpnRuntime(deps: VpnRuntimeDeps) {
  const profiles = new VpnProfileService(deps.repos, deps.vault)
  const drivers = new VpnDriverRegistry()

  if (deps.fake) {
    for (const kind of VpnKindSchema.options) {
      drivers.register(createFakeVpnDriverFactory(kind, () => ({ connectDelayMs: 800 })))
    }
  } else if (deps.openvpn) {
    const openvpn = deps.openvpn
    drivers.register({
      kind: 'openvpn',
      // Windows: through OpenVPN's Interactive Service (windows-openvpn-service.ts)
      isSupported: () => ({ ok: true }),
      create: () => new OpenVpnDriver(openvpn)
    })
  }
  if (!deps.fake && deps.strongswan) {
    const strongswan = deps.strongswan
    drivers.register({
      kind: 'ipsec-ikev1',
      // Windows: the same strongSwan inside North's WSL distro (wsl-ipsec.ts)
      isSupported: () => ({ ok: true }),
      create: () => new StrongswanDriver(strongswan)
    })
  } else if (!deps.fake && deps.macosIpsec) {
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
  if (!deps.fake && deps.platform === 'win32' && deps.openconnect) {
    const openconnect = deps.openconnect
    drivers.register({
      kind: 'fortinet-sslvpn',
      isSupported: () => ({ ok: true }),
      create: () => new OpenconnectDriver(openconnect)
    })
  } else if (!deps.fake && deps.openfortivpn) {
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
  if (!deps.fake && deps.windowsNative) {
    const native = deps.windowsNative
    drivers.register({
      kind: 'windows-native',
      isSupported: (platform) =>
        platform === 'win32'
          ? { ok: true }
          : {
              ok: false,
              reason: 'A VPN do Windows (PPTP, L2TP, SSTP, IKEv2) só existe no Windows'
            },
      create: () => new WindowsNativeDriver(native)
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
    emit: deps.emit,
    onNotice: deps.onNotice
  })

  return { profiles, drivers, manager, links: deps.repos.vpnProfiles }
}

export type VpnRuntime = ReturnType<typeof createVpnRuntime>

function rethrow(error: unknown): never {
  if (error instanceof VpnError) throw new Error(formatVpnErrorMessage(error.code, error.message))
  throw error
}

/** Log the elevated-process line, then send only a classified code across IPC. */
function failHelper(action: 'install' | 'uninstall', error: unknown): never {
  console.error(`[vpn] helper ${action} failed`, error)
  rethrow(new VpnError(classifyComponentFailure(error), ''))
}

/**
 * Channel → handler map. Every payload is parsed as untrusted input; no result
 * carries a secret (covered by vpn-runtime.test.ts).
 */
/** Where an organization keeps its client/environment VPN links (REC-023). */
export type OrganizationVpnLinks = {
  /** Local profile id, or undefined when the active workspace is the personal one. */
  link(target: 'client' | 'environment', id: string): Promise<string | null | undefined>
  /** True when the organization took it; false = personal workspace. */
  setLink(target: 'client' | 'environment', id: string, profileId: string | null): Promise<boolean>
  /** Whose VPN list the VPNs page shows (REC-025): 'local' or an organization. */
  workspace(): string
  /** In an organization, the client this person uses the VPN for; undefined in the personal one. */
  clientOf(profileId: string): string | null | undefined
}

export function createVpnHandlers(
  runtime: VpnRuntime,
  platform: NodeJS.Platform,
  helper?: Pick<VpnHelper, 'status' | 'install' | 'uninstall'>,
  /** VPN an Access resolves to (see VpnGate.profileForAccess) */
  accessProfile: (accessId: string) => string | null | Promise<string | null> = () => null,
  /** Client/environment links of the active organization (REC-023); undefined = personal workspace. */
  organization?: OrganizationVpnLinks
) {
  const helperStatus = (): VpnHelperStatus => helper?.status() ?? 'unsupported'
  const { profiles, manager, drivers } = runtime
  const workspace = () => organization?.workspace() ?? 'local'
  /** In an organization, a VPN's "client" is the client this person uses it for. */
  const shown = (profile: VpnProfile): VpnProfile => {
    const client = organization?.clientOf(profile.id)
    return client === undefined ? profile : { ...profile, clientId: client }
  }
  /** Organization: picking the client on the VPNs page is the person's choice for that client. */
  const moveClient = async (profileId: string, clientId: string | null) => {
    const before = organization?.clientOf(profileId)
    if (before === undefined) return
    if (before && before !== clientId) await organization?.setLink('client', before, null)
    if (clientId) await organization?.setLink('client', clientId, profileId)
  }
  return {
    [IpcChannels.VPN_LIST]: () =>
      profiles
        .list()
        .filter((p) => (p.workspaceId ?? 'local') === workspace())
        .map(shown),
    [IpcChannels.VPN_GET]: (id: unknown) => {
      const profile = profiles.get(IdSchema.parse(id))
      return profile ? shown(profile) : null
    },
    [IpcChannels.VPN_CREATE]: async (input: unknown) => {
      const parsed = CreateVpnProfileInputSchema.parse(input)
      const created = profiles.create(parsed, workspace())
      if (parsed.clientId) await moveClient(created.id, parsed.clientId)
      return shown(created)
    },
    [IpcChannels.VPN_UPDATE]: async (id: unknown, input: unknown) => {
      const profileId = IdSchema.parse(id)
      const parsed = UpdateVpnProfileInputSchema.parse(input)
      const updated = profiles.update(profileId, parsed)
      if (!updated) throw new Error('VPN não encontrada')
      if (parsed.clientId !== undefined) await moveClient(profileId, parsed.clientId)
      return shown(updated)
    },
    [IpcChannels.VPN_DELETE]: async (id: unknown) => {
      const profileId = IdSchema.parse(id)
      await manager.disconnect(profileId)
      profiles.delete(profileId)
    },
    [IpcChannels.VPN_IMPORT_OVPN]: async (input: unknown) => {
      try {
        const parsed = ImportOvpnInputSchema.parse(input)
        const result = profiles.importOvpn(parsed, workspace())
        if (!parsed.profileId && parsed.clientId)
          await moveClient(result.profile.id, parsed.clientId)
        return { ...result, profile: shown(result.profile) }
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
    [IpcChannels.VPN_PLATFORM_SUPPORT]: () => drivers.support(platform),
    [IpcChannels.VPN_LINK_GET]: async (input: unknown) => {
      const { target, id } = VpnLinkTargetSchema.parse(input)
      const fromOrganization = await organization?.link(target, id)
      if (fromOrganization !== undefined) return fromOrganization
      const links = runtime.links
      return target === 'client'
        ? links.linkForClient(id)
        : links.linkForEnvironment(id).environment
    },
    [IpcChannels.VPN_LINK_SET]: async (input: unknown) => {
      const { target, id, profileId } = SetVpnLinkInputSchema.parse(input)
      if (profileId && !profiles.get(profileId)) throw new Error('VPN não encontrada')
      if (await organization?.setLink(target, id, profileId)) return
      if (target === 'client') runtime.links.setClientLink(id, profileId)
      else runtime.links.setEnvironmentLink(id, profileId)
    },
    // the browser opens outside North, so this is a manual lease: it stays up until "Desligar"
    [IpcChannels.VPN_PREPARE_ACCESS]: async (id: unknown) => {
      const profileId = await accessProfile(IdSchema.parse(id))
      if (!profileId) return null
      try {
        return await manager.connect(profileId)
      } catch (error) {
        rethrow(error)
      }
    },
    [IpcChannels.VPN_HELPER_STATUS]: () => helperStatus(),
    [IpcChannels.VPN_HELPER_INSTALL]: async () => {
      try {
        await helper?.install()
      } catch (error) {
        failHelper('install', error)
      }
      return helperStatus()
    },
    [IpcChannels.VPN_HELPER_UNINSTALL]: async () => {
      try {
        await helper?.uninstall()
      } catch (error) {
        failHelper('uninstall', error)
      }
      return helperStatus()
    }
  }
}
