import { openvpnGatewayOnly, sameOpenvpnGateway } from '@shared/lib/vpn/ovpn-gateway'
import type { VpnConfig, VpnProfile } from '@shared/types'
import type { Repositories } from '../repositories'
import type { VpnChoiceTarget } from '../repositories/organization-vpn-choices-repository'
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
    private readonly repos: Pick<
      Repositories,
      'vpnProfiles' | 'organizationVpnLinks' | 'organizationVpnChoices'
    >
  ) {}

  /** This workspace's VPN list (REC-025). */
  private mine(): VpnProfile[] {
    return this.repos.vpnProfiles.list(this.workspaceId)
  }

  /**
   * A profile from this workspace's own list: itself, else one here for the same
   * gateway, else a copy (logins included). Copying between workspaces lands here.
   */
  adopt(profileId: string): string | null {
    return adoptVpnProfile(this.repos.vpnProfiles, profileId, this.workspaceId)
  }

  /** This person's VPN for a node: their own choice, else the organization's suggestion. */
  async resolve(
    target: VpnChoiceTarget,
    id: string,
    templateId: string | null | undefined,
    strict = false
  ): Promise<string | null> {
    const chosen = this.repos.organizationVpnChoices.get(this.workspaceId, target, id)
    if (chosen !== undefined) return chosen
    return strict ? this.requireLocal(templateId) : this.toLocal(templateId)
  }

  /**
   * This person picks a VPN for a node. It stays their own choice; the
   * organization learns it as the suggestion only when it had none, so
   * nobody else's VPN changes. Returns the template to store on the server,
   * or undefined to leave the server as it is.
   */
  async choose(
    target: VpnChoiceTarget,
    id: string,
    profileId: string | null,
    currentTemplate: string | null | undefined
  ): Promise<string | undefined> {
    const choices = this.repos.organizationVpnChoices
    const local = profileId ? this.adopt(profileId) : null
    if (profileId && !local) throw new Error('VPN não encontrada')
    // a connection or access without its own VPN just follows its environment
    if (!local && (target === 'connection' || target === 'access')) {
      choices.clear(this.workspaceId, target, id)
      return undefined
    }
    choices.set(this.workspaceId, target, id, local)
    if (local && !(currentTemplate && (await this.template(currentTemplate)))) {
      return (await this.toServer(local)) ?? undefined
    }
    return undefined
  }

  /** The client this person uses a VPN for, shown as its "client" on the VPNs page. */
  clientOf(profileId: string): string | null {
    return (
      this.repos.organizationVpnChoices
        .usedBy(this.workspaceId, profileId)
        .find((c) => c.target === 'client')?.id ?? null
    )
  }

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
    if (linked && vpnProfiles.get(linked)?.workspaceId === this.workspaceId) return linked
    const template = await this.template(templateId)
    if (!template) return null
    const match = this.mine().find((p) => sameGateway(p.config, template.config))
    // An OpenVPN can't be rebuilt from its address: wait for this person's own .ovpn.
    if (!match && template.config.kind === 'openvpn') return null
    const profileId =
      match?.id ??
      vpnProfiles.create(
        {
          name: template.name,
          // username stays empty: North asks for this person's login before connecting
          config: template.config,
          notes: template.notes
        },
        this.workspaceId
      ).id
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
    const adopted = this.adopt(profileId)
    if (!adopted) return null
    profileId = adopted
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

type WithVpn = { id?: string; vpnProfileId?: string | null }

/**
 * The organization inventory as this computer sees it: connections and
 * accesses carry this person's own VPN profile ids, like in the personal
 * workspace; the server's value is only the suggestion (REC-025).
 */
export function withLocalVpnIds(
  store: InventoryStore,
  bridge: OrganizationVpnBridge
): InventoryStore {
  const reader =
    (target: VpnChoiceTarget) =>
    async <T extends WithVpn>(item: T | null): Promise<T | null> =>
      item
        ? { ...item, vpnProfileId: await bridge.resolve(target, item.id ?? '', item.vpnProfileId) }
        : item
  const readerAll =
    (target: VpnChoiceTarget) =>
    async <T extends WithVpn>(items: T[]): Promise<T[]> => {
      const out: T[] = []
      for (const item of items) out.push((await reader(target)(item)) as T)
      return out
    }
  /** New item: this person's VPN is also the first suggestion. */
  const forCreate = async <T extends WithVpn>(
    input: T
  ): Promise<{ input: T; local: string | null }> => {
    if (!input.vpnProfileId) return { input, local: null }
    const local = bridge.adopt(input.vpnProfileId)
    return { input: { ...input, vpnProfileId: (await bridge.toServer(local)) ?? null }, local }
  }
  const forUpdate = async <T extends WithVpn>(
    target: VpnChoiceTarget,
    id: string,
    input: T,
    current: () => Promise<{ vpnProfileId?: string | null } | null>
  ): Promise<T> => {
    if (input.vpnProfileId === undefined) return input
    const template = await bridge.choose(
      target,
      id,
      input.vpnProfileId,
      (await current())?.vpnProfileId
    )
    const { vpnProfileId: _mine, ...rest } = input
    return (template === undefined ? rest : { ...rest, vpnProfileId: template }) as T
  }
  const { connections, accesses } = store
  const readConn = reader('connection')
  const readAccess = reader('access')
  return {
    ...store,
    connections: {
      list: async (filter) => readerAll('connection')(await connections.list(filter)),
      get: async (id) => readConn(await connections.get(id)),
      create: async (input) => {
        const { input: sent, local } = await forCreate(input)
        const created = await connections.create(sent)
        if (local) await bridge.choose('connection', created.id, local, sent.vpnProfileId)
        return (await readConn(created)) as typeof created
      },
      update: async (id, input) =>
        readConn(
          await connections.update(
            id,
            await forUpdate('connection', id, input, () => connections.get(id))
          )
        ),
      delete: (id) => connections.delete(id),
      toggleFavorite: async (id) => readConn(await connections.toggleFavorite(id)),
      duplicate: async (id) => readConn(await connections.duplicate(id))
    },
    accesses: {
      list: async (filter) => readerAll('access')(await accesses.list(filter)),
      get: async (id) => readAccess(await accesses.get(id)),
      create: async (input) => {
        const { input: sent, local } = await forCreate(input)
        const created = await accesses.create(sent)
        if (local) await bridge.choose('access', created.id, local, sent.vpnProfileId)
        return (await readAccess(created)) as typeof created
      },
      update: async (id, input) =>
        readAccess(
          await accesses.update(id, await forUpdate('access', id, input, () => accesses.get(id)))
        ),
      delete: (id) => accesses.delete(id),
      toggleFavorite: async (id) => readAccess(await accesses.toggleFavorite(id))
    }
  }
}

/** See OrganizationVpnBridge.adopt; also used when copying into My workspace. */
export function adoptVpnProfile(
  profiles: Repositories['vpnProfiles'],
  profileId: string,
  workspaceId: string
): string | null {
  const profile = profiles.get(profileId)
  if (!profile) return null
  if ((profile.workspaceId ?? 'local') === workspaceId) return profile.id
  const same = profiles
    .list(workspaceId)
    .find((p) => p.name === profile.name && sameGateway(p.config, profile.config))
  if (same) return same.id
  return profiles.clone(profile.id, workspaceId)?.id ?? null
}
