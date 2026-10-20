import { z } from 'zod'

/**
 * Who may do what in a workspace (ADR 0018 §7). Admin is global; editor and
 * viewer are granted on a client, environment or group and flow down. The
 * North Server enforces it; the desktop only uses it to hide actions.
 */
export const ProjectGrantSchema = z.object({
  scopeType: z.enum(['client', 'environment', 'group']),
  scopeId: z.string(),
  role: z.enum(['editor', 'viewer'])
})

export const WorkspaceAccessSchema = z.object({
  role: z.enum(['admin', 'member']),
  grants: z.array(ProjectGrantSchema)
})

export type ProjectGrant = z.infer<typeof ProjectGrantSchema>
export type WorkspaceAccess = z.infer<typeof WorkspaceAccessSchema>

/** The personal workspace: the person owns everything in it. */
export const FULL_ACCESS: WorkspaceAccess = { role: 'admin', grants: [] }

export type ProjectPath = {
  clientId?: string | null
  environmentId?: string | null
  groupId?: string | null
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
  const roles = new Map(access.grants.map((g) => [g.scopeId, g.role]))
  const edit = (path: ProjectPath): boolean => {
    if (isAdmin) return true
    return [path.groupId, path.environmentId, path.clientId].some(
      (id) => id != null && roles.get(id) === 'editor'
    )
  }
  return {
    isAdmin,
    createClient: isAdmin,
    editsSomething: isAdmin || access.grants.some((g) => g.role === 'editor'),
    edit,
    revealPassword: edit
  }
}
