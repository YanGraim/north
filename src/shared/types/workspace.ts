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
    createdAt: z.string()
  })
  .refine((w) => w.kind === 'local' || w.serverUrl !== null, {
    message: 'Organization workspaces need a server url',
    path: ['serverUrl']
  })

export type Workspace = z.infer<typeof WorkspaceSchema>
