import {
  type AddOrganizationInput,
  type CopyTargetTree,
  type CopyToWorkspaceInput,
  type CopyToWorkspaceReport,
  FULL_ACCESS,
  LOCAL_WORKSPACE_ID,
  type OrganizationServerInfo,
  type Workspace,
  type WorkspaceAccess,
  WorkspaceAccessSchema,
  type WorkspaceEvent,
  WorkspaceIdSchema
} from '@shared/types'
import type { Repositories } from '../repositories'
import type { WorkspacesRepository } from '../repositories/workspaces-repository'
import type { CredentialVault } from '../vault'
import { type InventoryStore, localInventoryStore } from './inventory-store'
import { signInWithBrowser } from './oidc-sign-in'
import {
  normalizeServerUrl,
  OrganizationClient,
  probeServer,
  type TokenStore
} from './organization-client'
import { OrganizationEvents } from './organization-events'
import { OrganizationVpnBridge, withLocalVpnIds } from './organization-vpns'
import { ORGANIZATION_UNAVAILABLE, RemoteInventoryStore } from './remote-inventory-store'
import { localSecretStore, RemoteSecretStore, type SecretStore } from './secret-store'
import { localWorkflowStore, RemoteWorkflowStore, type WorkflowStore } from './workflow-store'
import { type CopySide, copyTargets, copyToWorkspace } from './workspace-copy'

/**
 * Where a workspace's data lives (ADR 0018 §10). The inventory tree goes
 * through the async `InventoryStore` and passwords through a `SecretStore`;
 * every other repository is SQLite for the personal workspace and "not yet"
 * for organizations (except machine-level trust such as host keys).
 */
export interface WorkspaceDataSource {
  readonly kind: 'local' | 'remote'
  readonly inventory: InventoryStore
  readonly repositories: Repositories
  readonly secrets: SecretStore
  /** Workflows, group variables and environment updates (REC-024). */
  readonly workflows: WorkflowStore
}

class LocalDataSource implements WorkspaceDataSource {
  readonly kind = 'local' as const
  readonly inventory: InventoryStore
  readonly secrets: SecretStore
  readonly workflows: WorkflowStore
  constructor(
    readonly repositories: Repositories,
    vault: CredentialVault
  ) {
    this.inventory = localInventoryStore(repositories)
    this.secrets = localSecretStore(vault)
    this.workflows = localWorkflowStore(repositories)
  }
}

/**
 * What belongs to this computer, not to a workspace: TOFU host keys, and the
 * VPN profiles with this person's own logins (an organization shares only the
 * gateway, REC-023), so the VPN list is the same in every workspace.
 */
const MACHINE_REPOSITORIES = new Set<keyof Repositories>([
  'knownHosts',
  'vpnProfiles',
  'vpnSecrets',
  'vpnHistory',
  'organizationVpnLinks',
  'organizationWorkflowRuns',
  'organizationConnectionSecrets'
])

/**
 * Repositories an organization does not serve yet: `list*` reads come back
 * empty (screens render, just with nothing), anything else explains why.
 */
function unavailableRepositories(shape: Repositories): Repositories {
  const repo = new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== 'string') return undefined
        if (key.startsWith('list')) return () => []
        return () => {
          throw new Error(ORGANIZATION_UNAVAILABLE)
        }
      }
    }
  )
  return Object.fromEntries(
    Object.keys(shape).map((key) => [
      key,
      MACHINE_REPOSITORIES.has(key as keyof Repositories) ? shape[key as keyof Repositories] : repo
    ])
  ) as Repositories
}

class RemoteDataSource implements WorkspaceDataSource {
  readonly kind = 'remote' as const
  readonly inventory: InventoryStore
  readonly repositories: Repositories
  readonly secrets: SecretStore
  readonly workflows: WorkflowStore
  /** Organization VPN templates ↔ this computer's VPN profiles (REC-023). */
  readonly vpns: OrganizationVpnBridge
  /** Push channel, open while signed in (started on first activation). */
  events: OrganizationEvents | null = null
  constructor(
    readonly client: OrganizationClient,
    shape: Repositories,
    workspaceId: string
  ) {
    this.vpns = new OrganizationVpnBridge(client, workspaceId, shape)
    this.inventory = withLocalVpnIds(new RemoteInventoryStore(client), this.vpns)
    this.secrets = new RemoteSecretStore(client)
    this.workflows = new RemoteWorkflowStore(client, shape)
    this.repositories = unavailableRepositories(shape)
  }

  /** The VPN a client or environment brings up, as a local profile id. */
  async vpnLink(target: 'client' | 'environment', id: string): Promise<string | null> {
    const path = target === 'client' ? 'clients' : 'environments'
    const node = await this.client.request<{ vpnId?: string | null }>(
      'GET',
      `/api/v1/${path}/${id}`
    )
    return this.vpns.toLocal(node.vpnId)
  }

  async setVpnLink(
    target: 'client' | 'environment',
    id: string,
    profileId: string | null
  ): Promise<void> {
    const path = target === 'client' ? 'clients' : 'environments'
    await this.client.request('PATCH', `/api/v1/${path}/${id}`, {
      vpnId: (await this.vpns.toServer(profileId)) ?? null
    })
  }
}

/** Refresh token persisted through the vault; memory-only when encryption is unavailable. */
function vaultTokenStore(
  workspaces: WorkspacesRepository,
  vault: CredentialVault,
  workspaceId: string
): TokenStore {
  let memory: string | null = null
  return {
    get: () => {
      if (memory) return memory
      const ref = workspaces.refreshCredentialRef(workspaceId)
      if (!ref || !vault.hasSecret(ref) || !vault.isEncryptionAvailable()) return null
      memory = vault.resolveSecret(ref)
      return memory
    },
    set: (token) => {
      memory = token
      const ref = workspaces.refreshCredentialRef(workspaceId)
      if (!token) {
        if (ref) vault.deleteSecret(ref)
        workspaces.setRefreshCredentialRef(workspaceId, null)
        return
      }
      if (!vault.isEncryptionAvailable()) return
      workspaces.setRefreshCredentialRef(workspaceId, vault.setSecret(token, ref))
    }
  }
}

export class WorkspaceRegistry {
  private readonly local: LocalDataSource
  private readonly workspaces: WorkspacesRepository
  private readonly vault: CredentialVault
  private readonly remotes = new Map<string, RemoteDataSource>()
  private active: { workspace: Workspace; source: WorkspaceDataSource }
  private readonly liveEvents: boolean
  private listener: ((event: WorkspaceEvent) => void) | null = null
  private readonly openBrowser: (url: string) => Promise<void> | void
  private signIn: AbortController | null = null

  constructor(deps: {
    workspaces: WorkspacesRepository
    local: Repositories
    vault: CredentialVault
    /** Open each organization's events channel (off in tests that don't need it). */
    liveEvents?: boolean
    /** Opens the Microsoft sign-in page in the system browser (shell.openExternal). */
    openBrowser?: (url: string) => Promise<void> | void
  }) {
    this.openBrowser =
      deps.openBrowser ??
      (() => {
        throw new Error('Login pela Microsoft indisponível aqui.')
      })
    this.liveEvents = deps.liveEvents ?? true
    this.workspaces = deps.workspaces
    this.vault = deps.vault
    this.local = new LocalDataSource(deps.local, deps.vault)
    const localWorkspace = deps.workspaces.get(LOCAL_WORKSPACE_ID)
    if (!localWorkspace) {
      throw new Error('Local workspace missing — migration 017 not applied')
    }
    this.active = { workspace: localWorkspace, source: this.local }
  }

  list(): Workspace[] {
    return this.workspaces.list()
  }

  activeId(): string {
    return this.active.workspace.id
  }

  activeSource(): WorkspaceDataSource {
    return this.active.source
  }

  inventory(): InventoryStore {
    return this.active.source.inventory
  }

  secrets(): SecretStore {
    return this.active.source.secrets
  }

  workflows(): WorkflowStore {
    return this.active.source.workflows
  }

  /** Points main at a workspace. Organizations must have a live session (checked with `/me`). */
  async activate(id: string): Promise<Workspace> {
    const workspace = this.workspaces.get(WorkspaceIdSchema.parse(id))
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`)
    }
    if (workspace.kind === 'local') {
      this.active = { workspace, source: this.local }
      return workspace
    }
    const source = this.remoteFor(workspace)
    await source.client.request('GET', '/api/v1/me')
    this.active = { workspace, source }
    if (this.liveEvents) await this.startEvents(workspace.id, source)
    return workspace
  }

  /** Where main forwards organization pushes (renderer cache, open sessions). */
  onEvent(listener: ((event: WorkspaceEvent) => void) | null): void {
    this.listener = listener
  }

  /** Stops every events channel (app quit). */
  dispose(): void {
    for (const source of this.remotes.values()) source.events?.stop()
  }

  private async startEvents(workspaceId: string, source: RemoteDataSource): Promise<void> {
    if (source.events) return
    const emit = (event: WorkspaceEvent) => this.listener?.(event)
    const signedOut = (reason: 'revoked' | 'expired') => {
      source.events = null
      if (this.active.workspace.id === workspaceId) {
        this.active = {
          workspace: this.workspaces.get(LOCAL_WORKSPACE_ID) as Workspace,
          source: this.local
        }
      }
      // Revoked: the refresh token is dead on the server; drop it here too.
      void source.client.logout()
      emit({ workspaceId, kind: 'signed-out', reason })
    }
    source.events = new OrganizationEvents(source.client, {
      onInventoryChanged: (entity) => {
        if (entity === 'vpn' || entity === 'unknown') source.vpns.invalidate()
        emit({ workspaceId, kind: 'inventory', entity })
      },
      onAccessChanged: () => emit({ workspaceId, kind: 'access' }),
      onRevoked: () => signedOut('revoked'),
      onSignedOut: () => signedOut('expired')
    })
    await source.events.start()
  }

  /** Role and project grants in the active workspace; the personal one owns everything. */
  async access(): Promise<WorkspaceAccess> {
    const source = this.active.source
    if (!(source instanceof RemoteDataSource)) return FULL_ACCESS
    return WorkspaceAccessSchema.parse(await source.client.request('GET', '/api/v1/me/access'))
  }

  /**
   * The VPN a client or environment brings up in the active organization, as
   * a local profile id. Undefined in the personal workspace (the VPN repo
   * answers there).
   */
  async organizationVpnLink(
    target: 'client' | 'environment',
    id: string
  ): Promise<string | null | undefined> {
    const source = this.active.source
    return source instanceof RemoteDataSource ? source.vpnLink(target, id) : undefined
  }

  /** Links a client or environment of the active organization to a VPN; false in the personal one. */
  async setOrganizationVpnLink(
    target: 'client' | 'environment',
    id: string,
    profileId: string | null
  ): Promise<boolean> {
    const source = this.active.source
    if (!(source instanceof RemoteDataSource)) return false
    await source.setVpnLink(target, id, profileId)
    return true
  }

  /**
   * Which local VPN profile a session in the active organization needs:
   * the item's own, else its environment's, else its client's.
   */
  async organizationVpnFor(item: {
    vpnMode: 'inherit' | 'none' | 'profile'
    vpnProfileId: string | null
    groupId: string
  }): Promise<string | null> {
    const source = this.active.source
    if (!(source instanceof RemoteDataSource)) return null
    if (item.vpnMode === 'none') return null
    if (item.vpnMode === 'profile') return item.vpnProfileId
    const api = source.client
    const group = await api.request<{ environmentId: string }>(
      'GET',
      `/api/v1/groups/${item.groupId}`
    )
    const env = await api.request<{ clientId: string; vpnId?: string | null }>(
      'GET',
      `/api/v1/environments/${group.environmentId}`
    )
    if (env.vpnId) return source.vpns.requireLocal(env.vpnId)
    const client = await api.request<{ vpnId?: string | null }>(
      'GET',
      `/api/v1/clients/${env.clientId}`
    )
    return source.vpns.requireLocal(client.vpnId)
  }

  async probe(serverUrl: string): Promise<OrganizationServerInfo> {
    const { oidc, ...info } = await probeServer(serverUrl)
    return { ...info, entra: info.authModes.includes('entra') && oidc !== null }
  }

  /** Where a copy can land in another workspace (ADR 0018 §4). */
  async copyTargets(workspaceId: string): Promise<CopyTargetTree> {
    return copyTargets((await this.copySide(workspaceId)).inventory)
  }

  /** "Copiar para workspace…": from the active workspace (or the one named) into another one. */
  async copyToWorkspace(input: CopyToWorkspaceInput): Promise<CopyToWorkspaceReport> {
    const sourceId = input.sourceWorkspaceId ?? this.active.workspace.id
    if (input.targetWorkspaceId === sourceId) {
      throw new Error('Escolha outro workspace para a cópia')
    }
    const source = await this.copySide(sourceId)
    const target = await this.copySide(input.targetWorkspaceId)
    return copyToWorkspace(source, target, input)
  }

  private async copySide(id: string): Promise<CopySide> {
    const workspace = this.workspaces.get(WorkspaceIdSchema.parse(id))
    if (!workspace) throw new Error(`Workspace ${id} not found`)
    if (workspace.kind === 'local') {
      const links = this.local.repositories.vpnProfiles
      return {
        inventory: this.local.inventory,
        secrets: this.local.secrets,
        repositories: this.local.repositories,
        workflows: this.local.workflows,
        vpnLinks: {
          get: async (target, id) =>
            target === 'client'
              ? links.linkForClient(id)
              : links.linkForEnvironment(id).environment,
          set: async (target, id, profileId) =>
            target === 'client'
              ? links.setClientLink(id, profileId)
              : links.setEnvironmentLink(id, profileId)
        }
      }
    }
    const source = this.remoteFor(workspace)
    // Signed out of that organization → the usual "entre de novo" error, before copying anything.
    await source.client.request('GET', '/api/v1/me')
    return {
      inventory: source.inventory,
      secrets: source.secrets,
      repositories: null,
      workflows: source.workflows,
      vpnLinks: {
        get: (target, id) => source.vpnLink(target, id),
        set: (target, id, profileId) => source.setVpnLink(target, id, profileId)
      }
    }
  }

  /** Stops waiting for the browser (the person closed it or pressed Cancel). */
  cancelSignIn(): void {
    this.signIn?.abort()
    this.signIn = null
  }

  /** Signs in to a North Server and remembers it; signing in again reuses the workspace. */
  async addOrganization(input: AddOrganizationInput): Promise<Workspace> {
    const serverUrl = normalizeServerUrl(input.serverUrl)
    const info = await probeServer(serverUrl)
    const email = input.email
    let entra: { idToken: string; nonce: string } | null = null
    if (email) {
      if (!info.authModes.includes('dev')) {
        throw new Error('Este servidor só aceita login pela Microsoft (Entra ID).')
      }
    } else {
      if (!info.authModes.includes('entra') || !info.oidc) {
        throw new Error('Este servidor não tem login pela Microsoft configurado.')
      }
      this.signIn?.abort()
      const controller = new AbortController()
      this.signIn = controller
      try {
        // Browser first: nothing is saved until Microsoft says who this is.
        entra = await signInWithBrowser(info.oidc, {
          openBrowser: this.openBrowser,
          signal: controller.signal
        })
      } finally {
        if (this.signIn === controller) this.signIn = null
      }
    }
    const existing = this.workspaces.findByServerUrl(serverUrl)
    const workspace =
      existing ??
      this.workspaces.createOrganization({ name: info.name, serverUrl, userEmail: email ?? null })
    try {
      const client = this.remoteFor(workspace).client
      const user = entra
        ? await client.oidcLogin(entra.idToken, entra.nonce)
        : await client.devLogin(email as string, input.name)
      this.workspaces.setUserEmail(workspace.id, user.email)
    } catch (error) {
      if (!existing) this.forget(workspace.id)
      throw error
    }
    return this.workspaces.get(workspace.id) as Workspace
  }

  async removeOrganization(id: string): Promise<void> {
    const workspace = this.workspaces.get(WorkspaceIdSchema.parse(id))
    if (!workspace || workspace.kind !== 'organization') {
      throw new Error('Only organizations can be removed')
    }
    const source = this.remoteFor(workspace)
    source.events?.stop()
    source.events = null
    await source.client.logout()
    if (this.active.workspace.id === id) {
      this.active = {
        workspace: this.workspaces.get(LOCAL_WORKSPACE_ID) as Workspace,
        source: this.local
      }
    }
    this.forget(id)
  }

  repositoriesFor(id: string): Repositories {
    const workspace = this.workspaces.get(id)
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`)
    }
    return workspace.kind === 'local'
      ? this.local.repositories
      : this.remoteFor(workspace).repositories
  }

  private forget(id: string): void {
    const ref = this.workspaces.refreshCredentialRef(id)
    if (ref) this.vault.deleteSecret(ref)
    this.remotes.delete(id)
    this.workspaces.delete(id)
  }

  private remoteFor(workspace: Workspace): RemoteDataSource {
    let source = this.remotes.get(workspace.id)
    if (!source) {
      const client = new OrganizationClient(
        workspace.serverUrl as string,
        vaultTokenStore(this.workspaces, this.vault, workspace.id)
      )
      source = new RemoteDataSource(client, this.local.repositories, workspace.id)
      this.remotes.set(workspace.id, source)
    }
    return source
  }
}

/**
 * A `Repositories` view whose every property resolves through the active
 * workspace at access time, so existing IPC handlers keep their signature.
 */
export function createScopedRepositories(registry: WorkspaceRegistry): Repositories {
  const keys = Object.keys(registry.activeSource().repositories) as Array<keyof Repositories>
  const scoped = {} as Repositories
  for (const key of keys) {
    Object.defineProperty(scoped, key, {
      enumerable: true,
      get: () => registry.activeSource().repositories[key]
    })
  }
  return scoped
}
