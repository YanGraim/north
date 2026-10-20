import { z } from 'zod'

/** Built-in personal workspace backed by the local SQLite + vault (ADR 0018). */
export const LOCAL_WORKSPACE_ID = 'local'

/** URL-safe slug: it lives in the route (`/w/:workspaceId`) and in IPC payloads. */
export const WorkspaceIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Invalid workspace id')

export const WorkspaceKindSchema = z.enum(['local', 'organization'])

export type WorkspaceKind = z.infer<typeof WorkspaceKindSchema>

export const WorkspaceSchema = z
  .object({
    id: WorkspaceIdSchema,
    name: z.string().min(1),
    kind: WorkspaceKindSchema,
    serverUrl: z.string().url().nullable(),
    /** Who is signed in to this organization (null for the personal workspace). */
    userEmail: z.string().nullable(),
    createdAt: z.string()
  })
  .refine((w) => w.kind === 'local' || w.serverUrl !== null, {
    message: 'Organization workspaces need a server url',
    path: ['serverUrl']
  })

export type Workspace = z.infer<typeof WorkspaceSchema>

export const AddOrganizationInputSchema = z.object({
  serverUrl: z.string().min(1).max(500),
  email: z.string().email(),
  name: z.string().max(200).optional()
})

export type AddOrganizationInput = z.infer<typeof AddOrganizationInputSchema>

export type OrganizationServerInfo = { name: string; version: string; authModes: string[] }
