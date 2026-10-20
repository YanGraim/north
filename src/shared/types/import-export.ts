import { z } from 'zod'
import { CreateAccessInputSchema } from './access'
import { CreateClientInputSchema } from './client'
import { CreateConnectionInputSchema } from './connection'
import { CreateEnvironmentInputSchema } from './environment'
import { CreateGroupInputSchema } from './group'
import { CreateTagInputSchema } from './tag'
import {
  FortinetSslVpnConfigSchema,
  IpsecIkev1ConfigSchema,
  IpsecIkev2ConfigSchema,
  VpnAutoDisconnectSchema,
  VpnModeSchema
} from './vpn'
import { WorkflowDefinitionSchema } from './workflow'

/** A VPN link travels by name (ids don't survive another North). */
const VpnRefSchema = z.object({
  vpnMode: VpnModeSchema.optional(),
  vpnName: z.string().min(1).nullable().optional()
})

const ExportConnectionSchema = CreateConnectionInputSchema.omit({
  groupId: true,
  credentialRef: true,
  vpnMode: true,
  vpnProfileId: true
})
  .extend({
    tagNames: z.array(z.string()).optional()
  })
  .merge(VpnRefSchema)

const ExportAccessSchema = CreateAccessInputSchema.omit({
  groupId: true,
  credentialRef: true,
  vpnMode: true,
  vpnProfileId: true
})
  .extend({
    tagNames: z.array(z.string()).optional()
  })
  .merge(VpnRefSchema)

/** The group's workflows; the preferred server travels by its connection name. */
const ExportWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  preferredConnectionName: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  definition: WorkflowDefinitionSchema
})

/** Group variables are plain configuration (never secrets, by design). */
const ExportGroupVariableSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  description: z.string().nullable().optional()
})

const ExportGroupSchema = CreateGroupInputSchema.omit({ environmentId: true }).extend({
  connections: z.array(ExportConnectionSchema),
  accesses: z.array(ExportAccessSchema).default([]),
  workflows: z.array(ExportWorkflowSchema).default([]),
  variables: z.array(ExportGroupVariableSchema).default([])
})

const ExportEnvironmentSchema = CreateEnvironmentInputSchema.omit({ clientId: true }).extend({
  groups: z.array(ExportGroupSchema),
  vpnName: z.string().min(1).nullable().optional()
})

const ExportClientSchema = CreateClientInputSchema.extend({
  environments: z.array(ExportEnvironmentSchema),
  vpnName: z.string().min(1).nullable().optional()
})

/**
 * FortiGate SSL-VPN / IPsec connection data only: the user (empty) and every secret stay
 * personal. OpenVPN isn't exported: each person has their own .ovpn with their own keys.
 */
const ExportVpnConfigSchema = z.discriminatedUnion('kind', [
  IpsecIkev1ConfigSchema.extend({ username: z.literal('') }),
  IpsecIkev2ConfigSchema.extend({ username: z.literal('') }),
  FortinetSslVpnConfigSchema.extend({ username: z.literal('') })
])

const ExportVpnSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().min(1).nullable().optional(),
  config: ExportVpnConfigSchema,
  autoDisconnect: VpnAutoDisconnectSchema.optional(),
  idleTimeoutSec: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional()
})

/**
 * Inventory JSON export.
 * - schemaVersion 1: connections only (accesses treated as [] on import)
 * - schemaVersion 2: connections + accesses under each group
 * - schemaVersion 3: + workflows and variables per group, VPNs (no user, no secrets, no
 *   OpenVPN) and which VPN each client/environment/connection/access uses
 */
export const InventoryExportSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exportedAt: z.string().min(1),
  includeSecrets: z.literal(false).default(false),
  clients: z.array(ExportClientSchema),
  tags: z.array(CreateTagInputSchema),
  vpns: z.array(ExportVpnSchema).default([])
})

export type InventoryExport = z.infer<typeof InventoryExportSchema>

export const ImportReportSchema = z.object({
  created: z.object({
    clients: z.number().int().nonnegative(),
    environments: z.number().int().nonnegative(),
    groups: z.number().int().nonnegative(),
    connections: z.number().int().nonnegative(),
    accesses: z.number().int().nonnegative(),
    tags: z.number().int().nonnegative(),
    workflows: z.number().int().nonnegative(),
    variables: z.number().int().nonnegative(),
    vpns: z.number().int().nonnegative()
  }),
  skipped: z.object({
    clients: z.number().int().nonnegative(),
    environments: z.number().int().nonnegative(),
    groups: z.number().int().nonnegative(),
    connections: z.number().int().nonnegative(),
    accesses: z.number().int().nonnegative(),
    tags: z.number().int().nonnegative(),
    workflows: z.number().int().nonnegative(),
    variables: z.number().int().nonnegative(),
    vpns: z.number().int().nonnegative()
  }),
  errors: z.array(z.string())
})

export type ImportReport = z.infer<typeof ImportReportSchema>

export type ExportConnection = z.infer<typeof ExportConnectionSchema>
export type ExportAccess = z.infer<typeof ExportAccessSchema>
export type ExportVpn = z.infer<typeof ExportVpnSchema>
export type ExportWorkflow = z.infer<typeof ExportWorkflowSchema>

export function emptyImportReport(): ImportReport {
  const zero = () => ({
    clients: 0,
    environments: 0,
    groups: 0,
    connections: 0,
    accesses: 0,
    tags: 0,
    workflows: 0,
    variables: 0,
    vpns: 0
  })
  return { created: zero(), skipped: zero(), errors: [] }
}
