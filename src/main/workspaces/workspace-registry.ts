import {
  type AddOrganizationInput,
  FULL_ACCESS,
  LOCAL_WORKSPACE_ID,
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
import {
  normalizeServerUrl,
  OrganizationClient,
  probeServer,
  type TokenStore
} from './organization-client'
import { OrganizationEvents } from './organization-events'
import { ORGANIZATION_UNAVAILABLE, RemoteInventoryStore } from './remote-inventory-store'
import { localSecretStore, RemoteSecretStore, type SecretStore } from './secret-store'

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
}

class LocalDataSource implements WorkspaceDataSource {
  readonly kind = 'local' as const
  readonly inventory: InventoryStore
  readonly secrets: SecretStore
  constructor(
    readonly repositories: Repositories,
    vault: CredentialVault
  ) {
    this.inventory = localInventoryStore(repositories)
    this.secrets = localSecretStore(vault)
  }
}

/** Trust that belongs to this computer, not to a workspace (TOFU host keys). */
const MACHINE_REPOSITORIES = new Set<keyof Repositories>(['knownHosts'])

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
  /** Push channel, open while signed in (started on first activation). */
  events: OrganizationEvents | null = null
  constructor(
    readonly client: OrganizationClient,
    shape: Repositories
  ) {
    this.inventory = new RemoteInventoryStore(client)
    this.secrets = new RemoteSecretStore(client)
    this.repositories = unavailableRepositories(shape)
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

  constructor(deps: {
    workspaces: WorkspacesRepository
    local: Repositories
    vault: CredentialVault
    /** Open each organization's events channel (off in tests that don't need it). */
    liveEvents?: boolean
  }) {
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
      onInventoryChanged: (entity) => emit({ workspaceId, kind: 'inventory', entity }),
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

  async probe(serverUrl: string) {
    return probeServer(serverUrl)
  }

  /** Signs in to a North Server and remembers it; signing in again reuses the workspace. */
  async addOrganization(input: AddOrganizationInput): Promise<Workspace> {
    const serverUrl = normalizeServerUrl(input.serverUrl)
    const info = await probeServer(serverUrl)
    if (!info.authModes.includes('dev')) {
      throw new Error(
        'Este servidor usa login corporativo (Entra ID), que chega em breve no North.'
      )
    }
    const existing = this.workspaces.findByServerUrl(serverUrl)
    const workspace =
      existing ??
      this.workspaces.createOrganization({ name: info.name, serverUrl, userEmail: input.email })
    try {
      const user = await this.remoteFor(workspace).client.devLogin(input.email, input.name)
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
      source = new RemoteDataSource(client, this.local.repositories)
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
