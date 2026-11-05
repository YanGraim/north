import { z } from 'zod'
import { normalizeLogFileList } from '../lib/log-file'
import { normalizeStartupDirectory } from '../lib/startup-directory'
import { IdSchema, IsoDateSchema } from './client'
import { VpnModeSchema } from './vpn'

const StartupDirectorySchema = z
  .string()
  .nullable()
  .transform((value, ctx): string | null => {
    const normalized = normalizeStartupDirectory(value)
    if (!normalized.ok) {
      ctx.addIssue({ code: 'custom', message: 'Invalid startup directory' })
      return z.NEVER
    }
    return normalized.value
  })

export const ConnectionProtocolSchema = z.enum([
  'ssh',
  'rdp',
  'vnc',
  'sftp',
  'ftp',
  'telnet',
  'serial',
  'http',
  'https',
  'custom'
])

export type ConnectionProtocol = z.infer<typeof ConnectionProtocolSchema>

export const AuthMethodSchema = z.enum(['password', 'key', 'agent', 'none'])

export type AuthMethod = z.infer<typeof AuthMethodSchema>

export const ConnectionLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1)
})

export type ConnectionLink = z.infer<typeof ConnectionLinkSchema>

export const ChecklistItemSchema = z.object({
  id: IdSchema,
  text: z.string().min(1),
  done: z.boolean()
})

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>

const LogFileDraftSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  label: z.string().nullable().optional()
})

const LogFilesParsedSchema = z
  .array(LogFileDraftSchema)
  .max(8)
  .transform((items, ctx) => {
    const normalized = normalizeLogFileList(items)
    if (!normalized.ok) {
      ctx.addIssue({ code: 'custom', message: 'Invalid log files' })
      return z.NEVER
    }
    return normalized.value
  })

export const ConnectionSchema = z.object({
  id: IdSchema,
  groupId: IdSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  protocol: ConnectionProtocolSchema,
  host: z.string().min(1),
  port: z.number().int().positive(),
  username: z.string().nullable(),
  authMethod: AuthMethodSchema,
  credentialRef: z.string().nullable(),
  privateKeyPath: z.string().nullable(),
  /** Like `ssh -A`: forward the local ssh-agent so commands on the host (e.g. git) can use it. */
  agentForward: z.boolean(),
  jumpHostId: IdSchema.nullable(),
  defaultCommand: z.string().nullable(),
  /** Remote directory the SSH shell and its SFTP browser open in. Blank means the login directory. */
  startupDirectory: StartupDirectorySchema.default(null),
  /** Remote log files an SSH connection can follow. Empty means no live tail. */
  logFiles: LogFilesParsedSchema.default([]),
  notes: z.string().nullable(),
  os: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  owner: z.string().nullable(),
  links: z.array(ConnectionLinkSchema),
  vpnRequired: z.boolean(),
  /** inherit = Environment's VPN, then Client's; none = never; profile = vpnProfileId */
  vpnMode: VpnModeSchema,
  vpnProfileId: IdSchema.nullable(),
  checklist: z.array(ChecklistItemSchema),
  relatedFiles: z.array(z.string()),
  isFavorite: z.boolean(),
  accessCount: z.number().int().nonnegative(),
  totalConnectedMs: z.number().int().nonnegative(),
  lastConnectedAt: IsoDateSchema.nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})

export type Connection = z.infer<typeof ConnectionSchema>

export const CreateConnectionInputSchema = z.object({
  groupId: IdSchema,
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  protocol: ConnectionProtocolSchema,
  host: z.string().min(1),
  port: z.number().int().positive(),
  username: z.string().nullable().optional(),
  authMethod: AuthMethodSchema,
  credentialRef: z.string().nullable().optional(),
  privateKeyPath: z.string().nullable().optional(),
  agentForward: z.boolean().optional(),
  jumpHostId: IdSchema.nullable().optional(),
  defaultCommand: z.string().nullable().optional(),
  startupDirectory: StartupDirectorySchema.optional(),
  logFiles: LogFilesParsedSchema.optional(),
  notes: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  links: z.array(ConnectionLinkSchema).optional(),
  vpnRequired: z.boolean().optional(),
  vpnMode: VpnModeSchema.optional(),
  vpnProfileId: IdSchema.nullable().optional(),
  checklist: z.array(ChecklistItemSchema).optional(),
  relatedFiles: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional()
})

export type CreateConnectionInput = z.infer<typeof CreateConnectionInputSchema>

export const UpdateConnectionInputSchema = CreateConnectionInputSchema.omit({
  groupId: true
})
  .partial()
  .extend({
    groupId: IdSchema.optional()
  })

export type UpdateConnectionInput = z.infer<typeof UpdateConnectionInputSchema>

export const ListConnectionsFilterSchema = z.object({
  groupId: IdSchema.optional(),
  environmentId: IdSchema.optional(),
  clientId: IdSchema.optional(),
  isFavorite: z.boolean().optional(),
  tagId: IdSchema.optional()
})

export type ListConnectionsFilter = z.infer<typeof ListConnectionsFilterSchema>

/** Result of saving a remote directory favorite. `path` is the normalized absolute. */
export type DirectoryFavoriteAddResult =
  | { status: 'added'; path: string }
  | { status: 'duplicate'; path: string }
  | { status: 'invalid' }
