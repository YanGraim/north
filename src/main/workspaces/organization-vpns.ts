import { openvpnGatewayOnly, sameOpenvpnGateway } from '@shared/lib/vpn/ovpn-gateway'
import type { VpnConfig, VpnProfile } from '@shared/types'
import type { Repositories } from '../repositories'
import type { InventoryStore } from './inventory-store'
import type { OrganizationClient } from './organization-client'

/** What an organization keeps of a VPN: the gateway part, never a login (REC-023). */
export type OrganizationVpn = {
  id: string
  name: string
  kind: VpnProfile['kind']
  config: VpnConfig
  notes: string | null
}

export const VPN_NOT_SHAREABLE =
  'Esta VPN OpenVPN não tem endereço de servidor no .ovpn, então não dá para compartilhar com a organização.'

const isNotFound = (error: unknown) => (error as { status?: number }).status === 404

/** The organization shares an OpenVPN, but this person has not imported their own .ovpn yet. */
export const openvpnMissing = (name: string) =>
  `A VPN "${name}" é OpenVPN: cada pessoa usa o próprio arquivo .ovpn. Importe o seu na tela VPNs e tente de novo.`

/** Same gateway, same kind: the profile this person already made for that VPN. */
function sameGateway(a: VpnConfig, b: VpnConfig): boolean {
  if (a.kind === 'openvpn' && b.kind === 'openvpn') return sameOpenvpnGateway(a, b)
  if (a.kind !== b.kind || a.kind === 'openvpn' || b.kind === 'openvpn') return false
  if (a.gateway.trim().toLowerCase() !== b.gateway.trim().toLowerCase()) return false
  if (a.kind === 'fortinet-sslvpn' && b.kind === 'fortinet-sslvpn') return a.port === b.port
  return true
}

/**
 * Translates VPN ids at the organization boundary. The server stores template
 * ids; this computer stores profiles with the person's own login. Reading
 * maps a template to its local profile (linked before, else a profile with the
 * same gateway, else a new one without login that asks for it on first use);
 * writing maps a local profile to its template, publishing one when needed.
 * Everything past this boundary (sessions, VPN gate, UI) sees local ids only.
 */
export class OrganizationVpnBridge {
  private templates: Map<string, OrganizationVpn | null> = new Map()

  constructor(
    private readonly api: OrganizationClient,
    private readonly workspaceId: string,
    private readonly repos: Pick<Repositories, 'vpnProfiles' | 'organizationVpnLinks'>
  ) {}

  /** Templates this person may see (the VPNs of what they can open). */
  list(): Promise<OrganizationVpn[]> {
    return this.api.request<OrganizationVpn[]>('GET', '/api/v1/vpns')
  }

  private async template(id: string): Promise<OrganizationVpn | null> {
    if (this.templates.has(id)) return this.templates.get(id) ?? null
    try {
      const vpn = await this.api.request<OrganizationVpn>('GET', `/api/v1/vpns/${id}`)
      this.templates.set(id, vpn)
      return vpn
    } catch (error) {
      if (!isNotFound(error)) throw error
      this.templates.set(id, null)
      return null
    }
  }

  /** Forget cached templates (the organization said VPNs changed). */
  invalidate(): void {
    this.templates.clear()
  }

  /** Organization template id → local profile id; null when the template is gone. */
  async toLocal(templateId: string | null | undefined): Promise<string | null> {
    if (!templateId) return null
    const { vpnProfiles, organizationVpnLinks } = this.repos
    const linked = organizationVpnLinks.profileFor(this.workspaceId, templateId)
    if (linked && vpnProfiles.get(linked)) return linked
    const template = await this.template(templateId)
    if (!template) return null
    const match = vpnProfiles.list().find((p) => sameGateway(p.config, template.config))
    // An OpenVPN can't be rebuilt from its address: wait for this person's own .ovpn.
    if (!match && template.config.kind === 'openvpn') return null
    const profileId =
      match?.id ??
      vpnProfiles.create({
        name: template.name,
        // username stays empty: North asks for this person's login before connecting
        config: template.config,
        notes: template.notes
      }).id
    organizationVpnLinks.set(this.workspaceId, templateId, profileId)
    return profileId
  }

  /** Like toLocal, for a session about to start: says what's missing instead of skipping the VPN. */
  async requireLocal(templateId: string | null | undefined): Promise<string | null> {
    const local = await this.toLocal(templateId)
    if (local || !templateId) return local
    const template = await this.template(templateId)
    if (template?.config.kind === 'openvpn') throw new Error(openvpnMissing(template.name))
    return null
  }

  /** Local profile id → organization template id, publishing the gateway the first time. */
  async toServer(profileId: string | null | undefined): Promise<string | null | undefined> {
    if (profileId === undefined || profileId === null) return profileId
    const { vpnProfiles, organizationVpnLinks } = this.repos
    const known = organizationVpnLinks.templateFor(this.workspaceId, profileId)
    if (known && (await this.template(known))) return known
    const profile = vpnProfiles.get(profileId)
    if (!profile) return null
    // OpenVPN: only the address leaves this computer, never the certificate or key
    if (profile.config.kind === 'openvpn' && profile.config.remoteSummary.length === 0) {
      throw new Error(VPN_NOT_SHAREABLE)
    }
    const config =
      profile.config.kind === 'openvpn' ? openvpnGatewayOnly(profile.config) : profile.config
    // Someone already shared this gateway: reuse it instead of a duplicate.
    const shared = (await this.list()).find((t) => sameGateway(t.config, profile.config))
    const template =
      shared ??
      (await this.api.request<OrganizationVpn>('POST', '/api/v1/vpns', {
        name: profile.name,
        config,
        notes: profile.notes
      }))
    this.templates.set(template.id, template)
    organizationVpnLinks.set(this.workspaceId, template.id, profileId)
    return template.id
  }
}

type WithVpn = { vpnProfileId?: string | null }

/**
 * The organization inventory as this computer sees it: connections and
 * accesses carry local VPN profile ids, like in the personal workspace.
 */
export function withLocalVpnIds(
  store: InventoryStore,
  bridge: OrganizationVpnBridge
): InventoryStore {
  const read = async <T extends WithVpn>(item: T | null): Promise<T | null> =>
    item ? { ...item, vpnProfileId: await bridge.toLocal(item.vpnProfileId) } : item
  const readAll = async <T extends WithVpn>(items: T[]): Promise<T[]> => {
    const out: T[] = []
    for (const item of items) out.push((await read(item)) as T)
    return out
  }
  const write = async <T extends WithVpn>(input: T): Promise<T> =>
    input.vpnProfileId === undefined
      ? input
      : { ...input, vpnProfileId: await bridge.toServer(input.vpnProfileId) }
  const { connections, accesses } = store
  return {
    ...store,
    connections: {
      list: async (filter) => readAll(await connections.list(filter)),
      get: async (id) => read(await connections.get(id)),
      create: async (input) =>
        (await read(await connections.create(await write(input)))) as Awaited<
          ReturnType<typeof connections.create>
        >,
      update: async (id, input) => read(await connections.update(id, await write(input))),
      delete: (id) => connections.delete(id),
      toggleFavorite: async (id) => read(await connections.toggleFavorite(id)),
      duplicate: async (id) => read(await connections.duplicate(id))
    },
    accesses: {
      list: async (filter) => readAll(await accesses.list(filter)),
      get: async (id) => read(await accesses.get(id)),
      create: async (input) =>
        (await read(await accesses.create(await write(input)))) as Awaited<
          ReturnType<typeof accesses.create>
        >,
      update: async (id, input) => read(await accesses.update(id, await write(input))),
      delete: (id) => accesses.delete(id),
      toggleFavorite: async (id) => read(await accesses.toggleFavorite(id))
    }
  }
}
