import { z } from 'zod'
import { CreateAccessInputSchema } from './access'
import { CreateClientInputSchema } from './client'
import { CreateConnectionInputSchema } from './connection'
import { CreateEnvironmentInputSchema } from './environment'
import { CreateGroupInputSchema } from './group'
import { CreateTagInputSchema } from './tag'

const ExportConnectionSchema = CreateConnectionInputSchema.omit({
  groupId: true,
  credentialRef: true
}).extend({
  tagNames: z.array(z.string()).optional()
})

const ExportAccessSchema = CreateAccessInputSchema.omit({
  groupId: true,
  credentialRef: true
}).extend({
  tagNames: z.array(z.string()).optional()
})

const ExportGroupSchema = CreateGroupInputSchema.omit({ environmentId: true }).extend({
  connections: z.array(ExportConnectionSchema),
  accesses: z.array(ExportAccessSchema).default([])
})

const ExportEnvironmentSchema = CreateEnvironmentInputSchema.omit({ clientId: true }).extend({
  groups: z.array(ExportGroupSchema)
})

const ExportClientSchema = CreateClientInputSchema.extend({
  environments: z.array(ExportEnvironmentSchema)
})

/**
 * Inventory JSON export.
 * - schemaVersion 1: connections only (accesses treated as [] on import)
 * - schemaVersion 2: connections + accesses under each group
 */
export const InventoryExportSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string().min(1),
  includeSecrets: z.literal(false).default(false),
  clients: z.array(ExportClientSchema),
  tags: z.array(CreateTagInputSchema)
})

export type InventoryExport = z.infer<typeof InventoryExportSchema>

export const ImportReportSchema = z.object({
  created: z.object({
    clients: z.number().int().nonnegative(),
    environments: z.number().int().nonnegative(),
    groups: z.number().int().nonnegative(),
    connections: z.number().int().nonnegative(),
    accesses: z.number().int().nonnegative(),
    tags: z.number().int().nonnegative()
  }),
  skipped: z.object({
    clients: z.number().int().nonnegative(),
    environments: z.number().int().nonnegative(),
    groups: z.number().int().nonnegative(),
    connections: z.number().int().nonnegative(),
    accesses: z.number().int().nonnegative(),
    tags: z.number().int().nonnegative()
  }),
  errors: z.array(z.string())
})

export type ImportReport = z.infer<typeof ImportReportSchema>

export type ExportConnection = z.infer<typeof ExportConnectionSchema>
export type ExportAccess = z.infer<typeof ExportAccessSchema>
