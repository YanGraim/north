import { LOCAL_WORKSPACE_ID, type Workspace, WorkspaceIdSchema } from '@shared/types'
import type { Repositories } from '../repositories'
import type { WorkspacesRepository } from '../repositories/workspaces-repository'

/**
 * Where a workspace's inventory lives (ADR 0018 §10). `local` is SQLite; the
 * `remote` source (North Server API) arrives in phase 2 behind the same shape.
 */
export interface WorkspaceDataSource {
  readonly kind: 'local' | 'remote'
  readonly repositories: Repositories
}

export class LocalDataSource implements WorkspaceDataSource {
  readonly kind = 'local' as const
  constructor(readonly repositories: Repositories) {}
}

export class WorkspaceRegistry {
  private readonly local: LocalDataSource
  private active: { workspace: Workspace; source: WorkspaceDataSource }

  constructor(
    private readonly workspaces: WorkspacesRepository,
    localRepositories: Repositories
  ) {
    this.local = new LocalDataSource(localRepositories)
    const localWorkspace = workspaces.get(LOCAL_WORKSPACE_ID)
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

  activate(id: string): Workspace {
    const workspace = this.workspaces.get(WorkspaceIdSchema.parse(id))
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`)
    }
    this.active = { workspace, source: this.sourceFor(workspace) }
    return workspace
  }

  repositoriesFor(id: string): Repositories {
    const workspace = this.workspaces.get(id)
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`)
    }
    return this.sourceFor(workspace).repositories
  }

  private sourceFor(workspace: Workspace): WorkspaceDataSource {
    if (workspace.kind === 'local') return this.local
    throw new Error(
      `Workspace ${workspace.id} is not available yet (organizations need North Server)`
    )
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
