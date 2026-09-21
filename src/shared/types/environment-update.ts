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
  filesChanged: z.number().int().nonnegative()
})
export type EnvironmentUpdate = z.infer<typeof EnvironmentUpdateSchema>

export const CreateEnvironmentUpdateInputSchema = EnvironmentUpdateSchema.omit({ id: true })
export type CreateEnvironmentUpdateInput = z.infer<typeof CreateEnvironmentUpdateInputSchema>
