import { z } from 'zod'
import { ConnectionProtocolSchema } from './connection'

export const SearchIndexKindSchema = z.enum([
  'connection',
  'access',
  'client',
  'environment',
  'group',
  'tag'
])

export type SearchIndexKind = z.infer<typeof SearchIndexKindSchema>

export const SearchIndexItemSchema = z.object({
  id: z.string().uuid(),
  kind: SearchIndexKindSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  name: z.string(),
  host: z.string().nullable(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  owner: z.string().nullable(),
  clientName: z.string().nullable(),
  environmentName: z.string().nullable(),
  groupName: z.string().nullable(),
  tags: z.string().nullable(),
  username: z.string().nullable(),
  url: z.string().nullable(),
  database: z.string().nullable(),
  accessType: z.enum(['database', 'login', 'other']).nullable(),
  clientId: z.string().uuid().nullable(),
  environmentId: z.string().uuid().nullable(),
  groupId: z.string().uuid().nullable(),
  connectionId: z.string().uuid().nullable(),
  accessId: z.string().uuid().nullable(),
  tagId: z.string().uuid().nullable(),
  isFavorite: z.boolean(),
  lastConnectedAt: z.string().nullable(),
  protocol: ConnectionProtocolSchema.nullable(),
  icon: z.string().nullable()
})

export type SearchIndexItem = z.infer<typeof SearchIndexItemSchema>
