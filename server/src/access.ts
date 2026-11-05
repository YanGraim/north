import type { Db } from './db'
import { forbidden, notFound } from './errors'
import type { User } from './store/users'

export type ScopeType = 'client' | 'environment' | 'group' | 'connection'
export type ProjectRole = 'editor' | 'viewer'
export type Grant = { scopeType: ScopeType; scopeId: string; role: ProjectRole }

/**
 * What one user may do on each node (ADR 0018 §7). Admin is global; a grant
 * on a client/environment/group/connection flows down to everything under it,
 * given to the person or to a team they are in, and the strongest grant on the
 * path wins. The parents of a granted node stay visible (read-only) so the
 * tree can reach it.
 */
export type Level = 'admin' | 'editor' | 'viewer' | 'path' | null

const LABEL: Record<ScopeType, string> = {
  client: 'Client',
  environment: 'Environment',
  group: 'Group',
  connection: 'Connection'
}

const RANK: Record<ProjectRole, number> = { viewer: 1, editor: 2 }

/** One grant per node, the strongest of the person's own and their teams'. */
export function mergeGrants(grants: Grant[]): Grant[] {
  const best = new Map<string, Grant>()
  for (const g of grants) {
    const current = best.get(g.scopeId)
    if (!current || RANK[g.role] > RANK[current.role]) best.set(g.scopeId, g)
  }
  return [...best.values()]
}

export class AccessView {
  private readonly envClient = new Map<string, string>()
  private readonly groupEnv = new Map<string, string>()
  private readonly connGroup = new Map<string, string>()
  private readonly clients = new Set<string>()
  private readonly direct = new Map<string, ProjectRole>()
  private readonly paths = new Set<string>()

  constructor(
    readonly user: User,
    readonly grants: Grant[],
    tree: {
      clients: string[]
      environments: Array<{ id: string; clientId: string }>
      groups: Array<{ id: string; environmentId: string }>
      connections: Array<{ id: string; groupId: string }>
    }
  ) {
    for (const id of tree.clients) this.clients.add(id)
    for (const e of tree.environments) this.envClient.set(e.id, e.clientId)
    for (const g of tree.groups) this.groupEnv.set(g.id, g.environmentId)
    for (const c of tree.connections) this.connGroup.set(c.id, c.groupId)
    for (const g of mergeGrants(grants)) {
      this.direct.set(g.scopeId, g.role)
      for (const parent of this.ancestors(g.scopeType, g.scopeId).slice(1)) this.paths.add(parent)
    }
  }

  get isAdmin(): boolean {
    return this.user.role === 'admin'
  }

  /** Admin, or editor of at least one project. */
  get editsSomething(): boolean {
    return this.isAdmin || this.grants.some((g) => g.role === 'editor')
  }

  exists(type: ScopeType, id: string): boolean {
    if (type === 'client') return this.clients.has(id)
    if (type === 'environment') return this.envClient.has(id)
    if (type === 'group') return this.groupEnv.has(id)
    return this.connGroup.has(id)
  }

  /** The node itself first, then its parents up to the client. */
  private ancestors(type: ScopeType, id: string): string[] {
    if (type === 'client') return [id]
    if (type === 'environment') {
      const client = this.envClient.get(id)
      return client ? [id, client] : [id]
    }
    if (type === 'group') {
      const env = this.groupEnv.get(id)
      return env ? [id, ...this.ancestors('environment', env)] : [id]
    }
    const group = this.connGroup.get(id)
    return group ? [id, ...this.ancestors('group', group)] : [id]
  }

  level(type: ScopeType, id: string): Level {
    if (!this.exists(type, id)) return null
    if (this.isAdmin) return 'admin'
    let best: ProjectRole | null = null
    for (const node of this.ancestors(type, id)) {
      const role = this.direct.get(node)
      if (role && (!best || RANK[role] > RANK[best])) best = role
    }
    if (best) return best
    // Connections are the leaves, so a connection is never just a path.
    return this.paths.has(id) ? 'path' : null
  }

  canRead(type: ScopeType, id: string): boolean {
    return this.level(type, id) !== null
  }

  canWrite(type: ScopeType, id: string): boolean {
    const level = this.level(type, id)
    return level === 'admin' || level === 'editor'
  }

  /** 404 when the node is invisible (ids do not leak), 403 when read-only. */
  require(type: ScopeType, id: string, need: 'read' | 'write', what = LABEL[type]): void {
    if (!this.canRead(type, id)) throw notFound(what)
    if (need === 'write' && !this.canWrite(type, id)) {
      throw forbidden('You can only view this project')
    }
  }

  /** A connection's own grant, or one on its group and above. */
  requireConnection(connectionId: string, need: 'read' | 'write', what = 'Connection'): void {
    this.require('connection', connectionId, need, what)
  }
}

/** The person's own grants plus those of every team they belong to. */
export async function listGrants(db: Db, userId: string): Promise<Grant[]> {
  const { rows } = await db.query<{ scope_type: ScopeType; scope_id: string; role: ProjectRole }>(
    `SELECT scope_type, scope_id, role FROM project_grants WHERE user_id = $1
     UNION ALL
     SELECT pg.scope_type, pg.scope_id, pg.role
     FROM project_grants pg INNER JOIN team_members tm ON tm.team_id = pg.team_id
     WHERE tm.user_id = $1`,
    [userId]
  )
  return mergeGrants(
    rows.map((r) => ({ scopeType: r.scope_type, scopeId: r.scope_id, role: r.role }))
  )
}

/** Loaded once per request: the tree skeleton is small next to the inventory itself. */
export async function loadAccess(db: Db, user: User): Promise<AccessView> {
  const [grants, clients, environments, groups, connections] = await Promise.all([
    user.role === 'admin' ? Promise.resolve([]) : listGrants(db, user.id),
    db.query<{ id: string }>('SELECT id FROM clients'),
    db.query<{ id: string; client_id: string }>('SELECT id, client_id FROM environments'),
    db.query<{ id: string; environment_id: string }>('SELECT id, environment_id FROM groups'),
    db.query<{ id: string; group_id: string }>('SELECT id, group_id FROM connections')
  ])
  return new AccessView(user, grants, {
    clients: clients.rows.map((r) => r.id),
    environments: environments.rows.map((r) => ({ id: r.id, clientId: r.client_id })),
    groups: groups.rows.map((r) => ({ id: r.id, environmentId: r.environment_id })),
    connections: connections.rows.map((r) => ({ id: r.id, groupId: r.group_id }))
  })
}
