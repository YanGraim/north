import { z } from 'zod'

/**
 * Who may do what in a workspace (ADR 0018 §7). Admin is global; editor and
 * viewer are granted on a client, environment, group, a single connection or
 * a single access (directly or through a team) and flow down. The North Server enforces it;
 * the desktop only uses it to hide actions.
 */
export const ProjectGrantSchema = z.object({
  scopeType: z.enum(['client', 'environment', 'group']),
  scopeId: z.string(),
  role: z.enum(['editor', 'viewer'])
})

export const ConnectionGrantSchema = z.object({
  connectionId: z.string(),
  role: z.enum(['editor', 'viewer'])
})

export const AccessGrantSchema = z.object({
  accessId: z.string(),
  role: z.enum(['editor', 'viewer'])
})

export const WorkspaceAccessSchema = z.object({
  role: z.enum(['admin', 'member']),
  grants: z.array(ProjectGrantSchema),
  /** Servers before teams/connection grants do not send it. */
  connectionGrants: z.array(ConnectionGrantSchema).default([]),
  /** Servers before organization accesses (REC-023) do not send it. */
  accessGrants: z.array(AccessGrantSchema).default([]),
  /** The teams the person is in (REC-024); servers before it do not send it. */
  teams: z.array(z.object({ id: z.string(), name: z.string() })).default([])
})

export type ProjectGrant = z.infer<typeof ProjectGrantSchema>
export type ConnectionGrant = z.infer<typeof ConnectionGrantSchema>
export type AccessGrant = z.infer<typeof AccessGrantSchema>
export type WorkspaceAccess = z.infer<typeof WorkspaceAccessSchema>

/** The personal workspace: the person owns everything in it. */
export const FULL_ACCESS: WorkspaceAccess = {
  role: 'admin',
  grants: [],
  connectionGrants: [],
  accessGrants: [],
  teams: []
}

export type ProjectPath = {
  clientId?: string | null
  environmentId?: string | null
  groupId?: string | null
  connectionId?: string | null
  accessId?: string | null
}

export type Permissions = {
  isAdmin: boolean
  /** New clients are new projects: admins only. */
  createClient: boolean
  /** Editor somewhere: may add connections, tags and passwords. */
  editsSomething: boolean
  /** Create inside, edit or delete the node at this path. */
  edit: (path: ProjectPath) => boolean
  /** Show or paste the plaintext; viewers only ever use it to connect. */
  revealPassword: (path: ProjectPath) => boolean
}

export function permissionsFor(access: WorkspaceAccess): Permissions {
  const isAdmin = access.role === 'admin'
  const roles = new Map<string, 'editor' | 'viewer'>(access.grants.map((g) => [g.scopeId, g.role]))
  for (const g of access.connectionGrants ?? []) roles.set(g.connectionId, g.role)
  for (const g of access.accessGrants ?? []) roles.set(g.accessId, g.role)
  const edit = (path: ProjectPath): boolean => {
    if (isAdmin) return true
    return [path.accessId, path.connectionId, path.groupId, path.environmentId, path.clientId].some(
      (id) => id != null && roles.get(id) === 'editor'
    )
  }
  return {
    isAdmin,
    createClient: isAdmin,
    editsSomething:
      isAdmin ||
      [...access.grants, ...(access.connectionGrants ?? []), ...(access.accessGrants ?? [])].some(
        (g) => g.role === 'editor'
      ),
    edit,
    revealPassword: edit
  }
}
