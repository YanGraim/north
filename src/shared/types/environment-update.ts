import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'

export const EnvironmentUpdateCommitSchema = z.object({
  hash: z.string(),
  message: z.string()
})
export type EnvironmentUpdateCommit = z.infer<typeof EnvironmentUpdateCommitSchema>

export const EnvironmentUpdateStatusSchema = z.enum(['success', 'failed'])
export type EnvironmentUpdateStatus = z.infer<typeof EnvironmentUpdateStatusSchema>

/**
 * One recorded Git update against an environment, captured automatically by
 * a workflow run with `tracking` enabled — never user-created directly.
 */
export const EnvironmentUpdateSchema = z.object({
  id: IdSchema,
  environmentId: IdSchema,
  connectionId: IdSchema,
  workflowId: IdSchema,
  workflowRunId: IdSchema,
  branch: z.string(),
  previousCommit: z.string(),
  currentCommit: z.string(),
  startedAt: IsoDateSchema,
  finishedAt: IsoDateSchema,
  status: EnvironmentUpdateStatusSchema,
  commits: z.array(EnvironmentUpdateCommitSchema),
  filesChanged: z.number().int().nonnegative(),
  /** Git tag on the updated commit (e.g. v3.5.040); null when it has none. */
  tag: z.string().nullable().optional(),
  /**
   * Who ran it, in an organization (REC-024). Absent in the personal
   * workspace; null when that person was removed from the server.
   */
  ranBy: z
    .object({ id: z.string(), name: z.string().nullable(), email: z.string() })
    .nullable()
    .optional()
})
export type EnvironmentUpdate = z.infer<typeof EnvironmentUpdateSchema>

export const CreateEnvironmentUpdateInputSchema = EnvironmentUpdateSchema.omit({
  id: true,
  ranBy: true
})
export type CreateEnvironmentUpdateInput = z.infer<typeof CreateEnvironmentUpdateInputSchema>
