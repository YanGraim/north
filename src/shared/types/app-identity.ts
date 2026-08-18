import { z } from 'zod'

export const AppIdentitySchema = z.object({
  osUsername: z.string()
})

export type AppIdentity = z.infer<typeof AppIdentitySchema>
