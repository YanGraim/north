import { z } from 'zod'
import { IdSchema } from './client'

export const SetSecretInputSchema = z.object({
  secret: z.string().min(1),
  /** When set, replaces the blob for this ref (stable credentialRef). */
  credentialRef: IdSchema.optional()
})

export type SetSecretInput = z.infer<typeof SetSecretInputSchema>

export const RevealSecretInputSchema = z.object({
  credentialRef: IdSchema
})

export type RevealSecretInput = z.infer<typeof RevealSecretInputSchema>
