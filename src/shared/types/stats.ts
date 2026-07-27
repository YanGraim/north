import { z } from 'zod'
import { ConnectionSchema } from './connection'
import { ConnectionHistoryEntrySchema } from './history'

export const StatsOverviewSchema = z.object({
  totals: z.object({
    clients: z.number().int().nonnegative(),
    connections: z.number().int().nonnegative(),
    favorites: z.number().int().nonnegative()
  }),
  favorites: z.array(ConnectionSchema),
  recent: z.array(ConnectionSchema),
  mostUsed: z.array(ConnectionSchema),
  activity: z.array(ConnectionHistoryEntrySchema)
})

export type StatsOverview = z.infer<typeof StatsOverviewSchema>
